typeSupportHelpers.push(cncmachinefoundationtype = {
    /* IDetailPane Interface Properties */
    typeName: "cncmachinefoundation",
    rootElement: null,
    instanceId: null,
    queryHelper: null,

    /* Private implementation-specific properties */
    ready: true,
    cncAxisChart: null,
    gauges: [],
    chartSampleCount: 10,
    axes: [],
    chartData: {
      labels: [
        '0',
        '10',
        '20',
        '30',
        '40',
        '50',
        '60',
        '70',
        '80'
      ],
      datasets: [],
    },
    gaugeOpts: {
      angle: -0.02, // The span of the gauge arc
      lineWidth: 0.44, // The line thickness
      radiusScale: 1, // Relative radius
      pointer: {
        length: 0.6, // // Relative to gauge radius
        strokeWidth: 0.035, // The thickness
        color: '#000000' // Fill color
      },
      limitMax: false,     // If false, max value increases automatically if value > maxValue
      limitMin: false,     // If true, the min value of the gauge will be fixed
      colorStart: '#6FADCF', 
      colorStop: '#8FC0DA',
      strokeColor: '#E0E0E0',
      generateGradient: true,
      highDpiSupport: true, 
    },
    chartColors: {
      blue: 'rgb(0,48,143)',
      purple: 'rgb(153, 102, 255)',
      dimred: 'rgb(255, 99, 132)',
      orange: 'rgb(255,103,0)',
      yellow: 'rgb(255, 205, 86)',
      dimgreen: 'rgb(75, 192, 192)',
      brightred: 'rgb(211,33,45)',
      grey: 'rgb(201, 203, 207)',
      teal: 'rgb(77,166,255)',
      green: 'rgb(102,255,0)',
      lightblue: 'rgb(124,185,232)',
    },

    /* IDetailPane Interface Methods */
    create: function(rootElement) {
      logger.info("Activating cncmachinefoundation detail pane!");
      include("TypeSupport/cncmachinefoundation/gauge.js");
      include({ 
        src:"TypeSupport/cncmachinefoundation/chart.min.js",
      }, () => {
        /*add elements to DOM once dependency scripts are loaded*/
        logger.info("Dependencies loaded for cncmachinefoundation, initializing UI.")
        this.rootElement = appFramework.validateRootElement(rootElement);
        if (this.rootElement) {  
          if (document.getElementById("gaugesDiv") == null) {
            var gaugesDiv = document.createElement("div");
            gaugesDiv.id = "gaugesDiv";
            this.rootElement.appendChild(gaugesDiv);
          }
          if (document.getElementById("axisData") == null) {
            var chartDiv = document.createElement("div");
            chartDiv.id = "axisData";
            chartDiv.setAttribute("class", "cncmachinefoundationtype-chart");
            var chartCanvas = document.createElement("canvas");
            chartCanvas.id = "axisCanvas";
            chartCanvas.setAttribute("class", "cncmachinefoundationtype-chartcanvas");
            chartDiv.appendChild(chartCanvas);
            this.rootElement.appendChild(chartDiv);
          }
          this.queryHelper(smip.queries.getEquipmentChildren(this.instanceId), this.renderUI);
        }
      });
    },
    loadMachines: function(callBack) {
      this.queryHelper(smip.queries.getEquipmentsByTypeName(this.typeName, config.app.modelParentId), callBack.bind(this));
    },
    update: function() {
      if (this.ready) {
        logger.info("Processing update request on CNC Machine Foundation detail pane at " + new Date().toString());
        this.getAxesData();
        this.getGaugeData();
      } else {
        logger.info("Ignoring update request on CNC Machine Foundation detail pane since not ready");
      }
    },
    destroy: function() {
      if (this.cncAxisChart != null)
        this.cncAxisChart.destroy();
      this.chartData.datasets = [];
      this.cncAxisChart = null;
      this.gauges = [];
      if (document.getElementById("gaugesDiv") != null) 
        document.getElementById("gaugesDiv").remove();
      if (document.getElementById("axisData") != null) 
        document.getElementById("axisData").remove();     
      while (this.rootElement.firstChild) {
        this.rootElement.removeChild(this.rootElement.lastChild);
      }   
    },

    /* Private implementation-specific methods */
    renderUI: function(payload, query, self) {
      self.axes = self.parseAxis(payload);
      self.gauges = self.parseGaugeAttr(payload);
      self.renderAxisChart();
      self.renderGauges();
      //Tell container we're ready for updates
      this.ready = true;
      self.update();
    },
    parseAxis: function(payload) {
        logger.info("Starting parseAxis with payload:", payload);
        var discoveredAxis = [];

        if (!payload) {
            logger.error("parseAxis: Payload is null or undefined");
            return discoveredAxis;
        }

        if (!payload.data || !payload.data.equipment || !payload.data.equipment.childEquipment) {
            logger.error("parseAxis: Invalid payload structure. Expected data.equipment.childEquipment");
            return discoveredAxis;
        }

        var children = payload.data.equipment.childEquipment;
        logger.info("Number of child equipment found:", children.length);
        
        // First try the original structure (ChannelList path)
        for (var c = 0; c < children.length; c++) {
            if (children[c].displayName.toLowerCase() === "channellist") {
                logger.info("Found ChannelList:", children[c]);
                
                if (!children[c].childEquipment || !children[c].childEquipment[0]) {
                    logger.warn("ChannelList has no children or first child is missing");
                    continue;
                }

                var channelChildren = children[c].childEquipment[0].childEquipment;
                logger.info("Channel children found:", channelChildren ? channelChildren.length : 0);

                if (!channelChildren) {
                    logger.warn("No channel children found in ChannelList");
                    continue;
                }

                for (var d = 0; d < channelChildren.length; d++) {
                    var child = channelChildren[d];
                    if (!child) {
                        logger.warn("Null child found in channel children at index", d);
                        continue;
                    }

                    if (child.displayName.toLowerCase() === "positionbcs" || child.displayName.toLowerCase() === "positionwcs") {
                        logger.info(`Found ${child.displayName}:`, child);
                        
                        if (!child.childEquipment) {
                            logger.warn(`${child.displayName} has no child equipment`);
                            continue;
                        }

                        var axisList = child.childEquipment;
                        logger.info("Axes found in position data:", axisList.length);

                        for (var e = 0; e < axisList.length; e++) {
                            if (!axisList[e].attributes) {
                                logger.warn(`Axis ${axisList[e].displayName} has no attributes`);
                                continue;
                            }

                            discoveredAxis.push({
                                "displayName": axisList[e].displayName,
                                "equipmentId": axisList[e].id,
                                "attributes": axisList[e].attributes,
                                "timestamps": [],
                                "samples": []
                            });
                            logger.info(`Added axis from ChannelList structure: ${axisList[e].displayName}`);
                        }
                    }
                }
            }
            
            // Try the new structure (MachineStatus path)
            if (children[c].displayName === "MachineStatus") {
                logger.info("Found MachineStatus:", children[c]);
                
                if (!children[c].childEquipment) {
                    logger.warn("MachineStatus has no child equipment");
                    continue;
                }

                var machineStatusChildren = children[c].childEquipment;
                logger.info("MachineStatus children found:", machineStatusChildren.length);

                for (var m = 0; m < machineStatusChildren.length; m++) {
                    var axis = machineStatusChildren[m];
                    if (!axis) {
                        logger.warn("Null axis found in MachineStatus children at index", m);
                        continue;
                    }

                    if (axis.displayName.toLowerCase().includes('axis')) {
                        logger.info("Found axis in MachineStatus:", axis);

                        if (!axis.attributes) {
                            logger.warn(`Axis ${axis.displayName} has no attributes`);
                            continue;
                        }

                        var positionAttr = axis.attributes.find(attr => attr.displayName === "Position");
                        if (!positionAttr) {
                            logger.warn(`No Position attribute found for axis ${axis.displayName}`);
                            continue;
                        }

                        // Map the new structure to match the expected format
                        var mappedAttributes = axis.attributes.map(attr => {
                            if (attr.displayName === "Position") {
                                return {
                                    id: attr.id,
                                    displayName: "ActualPosition"
                                };
                            }
                            return attr;
                        });
                        
                        var axisName = axis.displayName.replace('axis', '').replace('Axis', '');
                        discoveredAxis.push({
                            "displayName": axisName,
                            "equipmentId": axis.id,
                            "attributes": mappedAttributes,
                            "timestamps": [],
                            "samples": []
                        });
                        logger.info(`Added axis from MachineStatus structure: ${axisName}`);
                    }
                }
            }
        }

        if (discoveredAxis.length === 0) {
            logger.error("No axes were discovered in either ChannelList or MachineStatus structures");
        } else {
            logger.info("Total discovered axes:", discoveredAxis.length);
            logger.info("Discovered axes:", discoveredAxis);
        }

        return discoveredAxis;
    },
    getAxesData: function() {
      // Pause updates until this one is processed
      this.ready = false;
      // Determine time range
      var endtime = new Date(Date.now());
      var two_hours_ms = 2*60*60*1000 ;
      var starttime = new Date(endtime - two_hours_ms);
      var datatype = "floatvalue";

      // Build the list of attributes (pens) to be updated
      var attrIds = [];
      this.axes.forEach((axis) => {
        axis.attributes.forEach((attribute) => {
          if (attribute.displayName == "ActualPosition") {
            attrIds.push(attribute.id);
          }
        });
      });
      var attrIds = attrIds.join("\",\"");

      //Make one history query for all attributes
      var theQuery = smip.queries.getHistoricalData(attrIds, starttime.toISOString(), endtime.toISOString(), datatype);
      this.queryHelper(theQuery, this.processChartSamples.bind(this));
    },
    processChartSamples: function(payload, query) {
      if (payload && payload.data && 
        payload.data.getRawHistoryDataWithSampling && 
        payload.data.getRawHistoryDataWithSampling.length > 0)
      { 
        for (var i=0, j=payload.data.getRawHistoryDataWithSampling.length; i<j; i++) {
          var element = payload.data.getRawHistoryDataWithSampling[i];
          var useAxis = this.findAxisForAttribId(element.id, this.axes);
          if (useAxis != -1) {
            this.shiftAxisSampleWindow(element.ts, element.floatvalue, useAxis, this.axes, this.chartSampleCount);
            //find axis dataset in chart
            var found = false;
            for (var c=0;c<this.chartData.datasets.length;c++) {
              var dataSet=this.chartData.datasets[c];
              if (dataSet.label == this.axes[useAxis].displayName) {
                //update dataset.data
                dataSet.data = this.axes[useAxis].samples;
                logger.info("Updating chart data " + dataSet.label, JSON.stringify(dataSet.data));
                found = true;
              }
            }
            if (!found)
              logger.warn("Could not find chart axis data to update " + this.axes[useAxis].displayName);
            //update chart!
            this.cncAxisChart.update();
          } else {
            logger.warn("Could not find axis for sample data!");
          }
        }
      }
      else {
        logger.warn("The SMIP returned no parseable axis data for the queried time window.");
        if (payload["errors"] != undefined) {
          logger.warn("Errors from SMIP query: " + JSON.stringify(payload["errors"]));
        }  
      }
      this.ready = true;
    },
    findAxisForAttribId:function(attribId, axes) {
      for(var x=0;x<axes.length;x++) {
        if (axes[x].attributes) {
          var attribs = axes[x].attributes
          for(var a=0;a<attribs.length;a++) {
            if (attribs[a].id == attribId) {
              return x;
            }
          }
        }
      }
      return -1;
    },
    shiftAxisSampleWindow:function(ts, value, index, axis, count) {
      //Rules:
      // #1 Keep timestamps and samples aligned!
      // #2 Don't push if timestamp is the same as previous time stamp
      //     Note: Comparing times is hell in Javascript, turn them into strings
      var ts1 = "T" + ts;
      var ts2 = "T" + axis[index].timestamps[axis[index].timestamps.length-1];
      if (ts1 != ts2) {
        axis[index].samples.push(value);
        axis[index].timestamps.push(ts);  
      } else {
        logger.info("Not charting repeated timestamp!");
      }
      // #3 Keep number of charted samples below count
      if (axis[index].samples.length > count) { 
        axis[index].samples.shift();
        axis[index].timestamps.shift();
      }
    },
    renderAxisChart: function() {
      var chartRoot = document.getElementById('axisCanvas');
      this.chartData.datasets = [];
      for (var x=0;x<this.axes.length;x++) {      
        logger.info("pushing new axis to chart " + this.axes[x].displayName);
        useColor = this.chartColors;
        this.chartData.datasets.push({
          label: this.axes[x].displayName,
          data: [],
          fill: false,
          backgroundColor: Object.values(useColor),
          borderColor: Object.values(useColor),
          pointBackgroundColor: Object.values(useColor),
        })
      }
      this.cncAxisChart = new Chart(chartRoot,{
        type: 'line',
        data: this.chartData,
        options: {
          elements: {
            line: {
              borderWidth: 3
            }
          }
        },
      });
    },
    parseGaugeAttr: function(payload) {
        logger.info("Starting parseGaugeAttr with payload:", payload);
        var discoveredAttr = [];

        if (payload && payload.data && payload.data.equipment && payload.data.equipment.childEquipment) {
            // Find MachineStatus section
            var machineStatus = payload.data.equipment.childEquipment.find(child => 
                child.displayName === "MachineStatus"
            );

            if (machineStatus && machineStatus.childEquipment) {
                logger.info("Found MachineStatus:", machineStatus);

                // Find Spindle
                var spindle = machineStatus.childEquipment.find(child => 
                    child.displayName === "Spindle"
                );

                if (spindle) {
                    logger.info("Found Spindle:", spindle);

                    // Get Load attribute for Motor Load Rate
                    var loadAttr = spindle.attributes.find(attr => 
                        attr.displayName === "Load"
                    );
                    if (loadAttr) {
                        logger.info("Found Load attribute:", loadAttr);
                        discoveredAttr.push({
                            attrid: loadAttr.id,
                            gauge: null,
                            maxValue: 100,
                            name: "Motor"
                        });
                    } else {
                        logger.warn("Could not find Load attribute in Spindle!");
                    }

                    // Get Speed attribute for RPM
                    var speedAttr = spindle.attributes.find(attr => 
                        attr.displayName === "Speed"
                    );
                    if (speedAttr) {
                        logger.info("Found Speed attribute:", speedAttr);
                        discoveredAttr.push({
                            attrid: speedAttr.id,
                            gauge: null,
                            maxValue: 100,
                            name: "RPM"
                        });
                    } else {
                        logger.warn("Could not find Speed attribute in Spindle!");
                    }
                } else {
                    logger.warn("Could not find Spindle in MachineStatus!");
                }

                // Get Feedrate from MachineStatus
                var feedRateAttr = machineStatus.attributes.find(attr => 
                    attr.displayName === "Feedrate"
                );
                if (feedRateAttr) {
                    logger.info("Found Feedrate attribute:", feedRateAttr);
                    discoveredAttr.push({
                        attrid: feedRateAttr.id,
                        gauge: null,
                        maxValue: 100,
                        name: "Feed Rate"
                    });
                } else {
                    logger.warn("Could not find Feedrate attribute in MachineStatus!");
                }
            } else {
                logger.error("MachineStatus found but has no childEquipment!");
            }
        } else {
            logger.error("Payload did not include expected childEquipment, Gauges cannot be rendered!");
        }
        
        if (discoveredAttr.length === 0) {
            logger.error("No gauge attributes were discovered in the payload!");
        } else {
            logger.info("Discovered gauge attributes:", discoveredAttr);
        }
        
        return discoveredAttr;
    },
    getGaugeData() {
      var endtime = new Date(Date.now());
      var starttime = new Date(endtime - 2000);
      var datatype = 'floatvalue';

      // Build the list of attributes (pens) to be updated
      var attrIds = [];
      this.gauges.forEach((gauge) => {
        attrIds.push(gauge.attrid);
      });
      var attrIds = attrIds.join("\",\"");

      //Make one history query for all attributes
      var theQuery = smip.queries.getHistoricalData(attrIds, starttime.toISOString(), endtime.toISOString(), datatype);
      this.queryHelper(theQuery, this.processGaugeSamples.bind(this));
    },
    processGaugeSamples: function(payload, query) {
      // Get gauge id from attribute
      if (payload && payload.data && 
          payload.data.getRawHistoryDataWithSampling && 
          payload.data.getRawHistoryDataWithSampling.length > 0)
      {  
        //TODO: Sometimes we get double samples for each gauge -- this is an API bug, not a UI bug
        //  However, it introduces inefficiency and we might add logic to throw away extra data
        payload.data.getRawHistoryDataWithSampling.forEach((element) => {
          this.gauges.forEach((gauge, idx) => {
            if (element.id == gauge.attrid && element.floatvalue) {
              logger.info("Updating gauge data " + gauge.name + ": " + element.floatvalue);
              this.gauges[idx].gauge.set(element.floatvalue);
              document.getElementById(`gauge${idx}Value`).innerText = element.floatvalue;
            }
          })
        });
      } else {
        logger.warn("The SMIP returned no parseable gauge data for the queried time window.");
        if (payload["errors"] != undefined) {
          logger.warn("Errors from SMIP query: " + JSON.stringify(payload["errors"]));
        }  
      }
    },
    findChildEquipmentByDisplayName: function(childEquipName, parentEquipment) {
      if (childEquipName == null || parentEquipment == null)
        return null;
      var children = parentEquipment.childEquipment;
      for (var c=0;c<children.length;c++) {
        if (children[c].displayName.toLowerCase() == childEquipName.toLowerCase()) {
          return children[c];
        }
      }
      return null;
    },
    renderGauges: function() {
      var gaugesRoot = document.getElementById("gaugesDiv");
      this.gauges.forEach((gauge, idx) => {
        if (document.getElementById(`gauge${idx}Div`) == null) {
            var gaugeDiv = document.createElement("div");
            gaugeDiv.id = `gauge${idx}Div`;
            gaugeDiv.setAttribute("class", "cncmachinefoundationtype-gauge");
            var gaugeLabel = document.createElement("div");
            gaugeLabel.id = `gauge${idx}Label`;
            gaugeLabel.innerText = gauge.name;
            gaugeLabel.setAttribute("class", "cncmachinefoundationtype-gaugelabel");
            gaugeDiv.appendChild(gaugeLabel);
            var gaugeCanvas = document.createElement("canvas");
            gaugeCanvas.id = `gauge${idx}Canvas`;
            gaugeCanvas.setAttribute("class", "cncmachinefoundationtype-gaugecanvas");
            gaugeDiv.appendChild(gaugeCanvas);
            var gaugeValue = document.createElement("div");
            gaugeValue.id = `gauge${idx}Value`;
            gaugeValue.innerText = "0";
            gaugeValue.setAttribute("class", "cncmachinefoundationtype-gaugevalue");
            gaugeDiv.appendChild(gaugeValue);
            gaugesRoot.appendChild(gaugeDiv);
          }
        })

      // TODO: Gauges -> set max value more dyamically
      this.gauges.forEach((gauge, idx) => {
        var target = document.getElementById(`gauge${idx}Canvas`);
        this.gauges[idx].gauge = new Gauge(target).setOptions(this.gaugeOpts);
        this.gauges[idx].gauge.maxValue = this.gauges[idx].maxValue;
        this.gauges[idx].gauge.setMinValue(0);  // Prefer setter over gauge.minValue = 0
        this.gauges[idx].gauge.animationSpeed = 32; // set animation speed (32 is default value)
        this.gauges[idx].gauge.set(0); // set gauge value
      }, this)
    },

    makeRandomNumbers: function(count, min, max) {
      randoms = [];
      for (var r=0;r<count;r++) {
        var n = Math.random();
        randoms.push(Math.floor(n * (max - min) + min));
      }
      return randoms;
    },
});
