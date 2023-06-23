detailPane = {
    /* IDetailPane Interface Properties */
    typeName: "cncbasetype",
    rootElement: null,
    instanceId: null,
    queryHandler: null,

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
      console.log("Activating cncbasetype detail pane!");
      if (this.validateRootElement(rootElement)) {
        
        /*add elements to DOM*/
        if (document.getElementById("gaugesDiv") == null) {
          var gaugesDiv = document.createElement("div");
          gaugesDiv.id = "gaugesDiv";
          this.rootElement.appendChild(gaugesDiv);
        }
        if (document.getElementById("axisData") == null) {
          var chartDiv = document.createElement("div");
          chartDiv.id = "axisData";
          chartDiv.setAttribute("class", "cncbasetype-chart");
          var chartCanvas = document.createElement("canvas");
          chartCanvas.id = "axisCanvas";
          chartCanvas.setAttribute("class", "cncbasetype-chartcanvas");
          chartDiv.appendChild(chartCanvas);
          this.rootElement.appendChild(chartDiv);
        }
        this.queryHandler(queries.getEquipmentChildren(this.instanceId), this.renderUI);
      }
    },
    update: function() {
      console.log("Processing update request on CNC detail pane at " + new Date().toString());
      this.getAxesData();
      this.getGaugeData();
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
    },
    // helper to ensure this pane has a place to attach
    validateRootElement: function(rootElement) {
      if (rootElement)
        this.rootElement = rootElement;
      if (!this.rootElement || document.getElementById(rootElement) == null) {
        console.log("Cannot create detail pane without a root element!");
        return false;
      } else {
        if (this.rootElement.nodeName != "DIV") {
          this.rootElement = document.getElementById(rootElement);
          if (this.rootElement.nodeName != "DIV") {
            console.log("Root element for detail was not a DIV!");
            return false;
          } else {
            return true;
          }
        }
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
    getAxesData: function() {
      if (this.ready) {
        // Pause updates until this one is processed
        this.ready = false;
        // Determine time range
        var endtime = new Date(Date.now());
        var two_hours_ms = 2*60*60*1000 ;
        var starttime = new Date(endtime - two_hours_ms);
        var datatype = "floatvalue";

        for (var x=0;x<this.axes.length;x++) {
          var attrId;
          for (var y=0;y<this.axes[x].attributes.length;y++) {
            if (this.axes[x].attributes[y].displayName == "ActualPosition") {
              attrId = this.axes[x].attributes[y].id;
            }
          }
          //Get the history for current attribute
          this.queryHandler(queries.getHistoricalData(attrId, starttime.toISOString(), endtime.toISOString(), datatype), this.processSamples);
        }
      } else {
        if (config.debug)
          console.log("Ignoring update request since not ready");
      }
    },
    getGaugeData() {
      var endtime = new Date(Date.now());
      var starttime = new Date(endtime - 2000);
      var datatype = 'floatvalue';
      // For each attribute
      this.gauges.forEach((gauge,idx) => {
        this.queryHandler(queries.getHistoricalData(gauge.attrid, starttime.toISOString(), endtime.toISOString(), datatype), this.processGaugeSample);
      })
    },
    processGaugeSample: function(payload, query, self) {
      // Get gauge id from attribute
      var element = payload.data.getRawHistoryDataWithSampling[0];
      if (payload.data.getRawHistoryDataWithSampling.length > 0) { 
        self.gauges.forEach((gauge, idx) => {
          if (element.id == gauge.attrid) {
            self.gauges[idx].gauge.set(element.floatvalue);
            document.getElementById(`gauge${idx}Value`).innerText = element.floatvalue;
          }
        })
      }
    },
    processSamples: function(payload, query, self) {
      if (payload["errors"] != undefined) {
        console.log("Errors from SMIP query: " + errors);
      }
      else {
        for (var i=0, j=payload.data.getRawHistoryDataWithSampling.length; i<j; i++) {
          var element = payload.data.getRawHistoryDataWithSampling[i];
          var useAxis = self.findAxisForAttribId(element.id, self.axes);
          if (useAxis != -1) {
            self.shiftAxisSampleWindow(element.ts, element.floatvalue, useAxis, self.axes, self.chartSampleCount);
            if (config.debug)
              console.log("Axis data now: " + JSON.stringify(self.axes[useAxis]));
            //find axis dataset in chart
            var found = false;
            for (var c=0;c<self.chartData.datasets.length;c++) {
              var dataSet=self.chartData.datasets[c];
              if (dataSet.label == self.axes[useAxis].displayName) {
                //update dataset.data
                dataSet.data = self.axes[useAxis].samples;
                if (config.debug)
                  console.log("Updating chart data " + dataSet.label, JSON.stringify(dataSet.data));
                found = true;
              }
            }
            if (!found)
              console.log("Could not find chart axis data to update " + self.axes[useAxis].displayName);
            //update chart!
            self.cncAxisChart.update();
          } else {
            console.log("Could not find axis for sample data!");
          }
        }
      }
      self.ready = true;
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
        if (config.debug)
          console.log("Not charting repeated timestamp!");
      }
      // #3 Keep number of charted samples below count
      if (axis[index].samples.length > count) { 
        axis[index].samples.shift();
        axis[index].timestamps.shift();
      }
    },
    parseAxis:function(payload) {
      var discoveredAxis = [];
      if (payload && payload.data && payload.data.equipment && payload.data.equipment.childEquipment) {
        var children = payload.data.equipment.childEquipment;
        if (children.length > 0) {
          for (var c=0;c<children.length;c++) {
            if (children[c].displayName.toLowerCase() == "channellist") {
              for (var d=0;d<children[c].childEquipment[0].childEquipment.length;d++) {
                var child = children[c].childEquipment[0].childEquipment[d];
                if (child != undefined && (child.displayName.toLowerCase() == "positionbcs" || child.displayName.toLowerCase() == "positionwcs")) {
                  var axisList = child.childEquipment;
                  for (var e=0;e<axisList.length;e++) {
                    discoveredAxis.push( {"displayName":axisList[e].displayName, "equipmentId": axisList[e].id, "attributes": axisList[e].attributes, "timestamps":[], "samples": []});
                  }
                }
              }
            }
          }
        } else {
          console.log("Payload did not include expected childEquipment, Axis cannot be rendered!");
        }
      } else {
        console.log("Payload did not conform to Profile and cannot be rendered!");
      }
      return discoveredAxis;
    },
    parseGaugeAttr: function(payload) {
      var discoveredAttr = [];
      if (payload && payload.data && payload.data.equipment && payload.data.equipment.childEquipment) {
        var spindleList = this.findChildEquipmentByDisplayName("SpindleList", payload.data.equipment);
        var q = this.findChildEquipmentByDisplayName("Q", spindleList);
        var motor = this.findChildEquipmentByDisplayName("Motor", q);
        if (motor != null) {
          for (var d=0;d<motor.attributes.length;d++) {
            if (motor.attributes[d].displayName == "LoadRate")
              discoveredAttr.push({attrid:motor.attributes[d].id, gauge:null, maxValue:100, name: "Motor"});
          }
        } else {
          console.log("Warning CNC motor could not be found!");
        }
        var machineInfo = this.findChildEquipmentByDisplayName("MachineInformation", payload.data.equipment);
        var toolInfo = this.findChildEquipmentByDisplayName("ToolInformation", machineInfo);
        var toolStatus = this.findChildEquipmentByDisplayName("ToolStatus", toolInfo);
        var feedRate = this.findChildEquipmentByDisplayName("Feedrate", toolStatus);
        if (feedRate != null) {
          for (var d=0;d<feedRate.attributes.length;d++) {
            if (feedRate.attributes[d].displayName == "Actual")
              discoveredAttr.push({attrid:feedRate.attributes[d].id, gauge:null, maxValue:100, name: "Feed Rate"});
          }    
        } else {
          console.log("Warning CNC Feedrate could not be found!");
        }
        var rpm = this.findChildEquipmentByDisplayName("RPM", toolStatus);
        if (rpm != null) {
          for (var d=0;d<rpm.attributes.length;d++) {
            if (rpm.attributes[d].displayName == "Actual")
              discoveredAttr.push({attrid:rpm.attributes[d].id, gauge:null, maxValue:100, name: "RPM"});
          }    
        } else {
          console.log("Warning CNC RPM could not be found!");
        }
      } else {
        console.log("Payload did not include expected childEquipment, Gauges cannot be rendered!");
      }
      return discoveredAttr;
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
    renderAxisChart: function(instanceData) {
      var chartRoot = document.getElementById('axisCanvas');
      this.chartData.datasets = [];
      for (var x=0;x<this.axes.length;x++) {      
        if (config.debug)
          console.log("pushing new axis to chart " + this.axes[x].displayName);
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
    renderGauges: function() {
      var gaugesRoot = document.getElementById("gaugesDiv");
      this.gauges.forEach((gauge, idx) => {
        if (document.getElementById(`gauge${idx}Div`) == null) {
            var gaugeDiv = document.createElement("div");
            gaugeDiv.id = `gauge${idx}Div`;
            gaugeDiv.setAttribute("class", "cncbasetype-gauge");
            var gaugeLabel = document.createElement("div");
            gaugeLabel.id = `gauge${idx}Label`;
            gaugeLabel.innerText = gauge.name;
            gaugeLabel.setAttribute("class", "cncbasetype-gaugelabel");
            gaugeDiv.appendChild(gaugeLabel);
            var gaugeCanvas = document.createElement("canvas");
            gaugeCanvas.id = `gauge${idx}Canvas`;
            gaugeCanvas.setAttribute("class", "cncbasetype-gaugecanvas");
            gaugeDiv.appendChild(gaugeCanvas);
            var gaugeValue = document.createElement("div");
            gaugeValue.id = `gauge${idx}Value`;
            gaugeValue.innerText = "0";
            gaugeValue.setAttribute("class", "cncbasetype-gaugevalue");
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
};
