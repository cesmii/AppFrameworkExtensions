typeSupportHelpers.push(wellpumptype = {
    /* IDetailPane Interface Properties */
    typeName: "WellPumpingStation",
    smipTypeName: "well_pumping_station",
    rootElement: null,
    instanceId: null,
    queryHelper: null,

    /* Private implementation-specific properties */
    name: "wellPumpTypeSupport",
    scriptSrc: document.currentScript,
    ready: true,
    wellpumpChart: null,
    gauges: [],
    chartSampleCount: 10,
    pens: [],
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
    /* Define data presentations */
    trends: {
      power_consumed: {},
      pressure: {}
    },
    /* Ideally these enumerations would come from the platform, but its not currently supported through GraphQL */
    indicators: {
      control_mode: {
        2: "Auto",
        1: "Manual",
        0: "Off"
      },
      run_state : {
        3: "Running",
        2: "De-Accelerating",
        1: "Accelerating",
        0: "Stopped"
      }
    },
    /* Configure gauges */
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
      logger.info("Activating wellpumptype detail pane!");
      var scriptUrl = this.scriptSrc.src.replace("wellpumptype.js", "gauge.js");
      include(scriptUrl);
      include({ 
        src:"https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js",
        integrity: "sha512-ElRFoEQdI5Ht6kZvyzXhYG9NqjtkmlkfYk0wr6wHxU9JEHakS7UJZNeml5ALk+8IKlU6jDgMabC3vkumRokgJA==",
        crossOrigin: "anonymous",
        referrerpolicy:"no-referrer"
      }, () => {
        this.rootElement = appFramework.validateRootElement(rootElement);
        if (this.rootElement) {  
          /*add elements to DOM once dependency scripts are loaded*/
          if (document.getElementById("gaugesDiv") == null) {
            var gaugesDiv = document.createElement("div");
            gaugesDiv.id = "gaugesDiv";
            this.rootElement.appendChild(gaugesDiv);
          }
          if (document.getElementById("penData") == null) {
            var chartDiv = document.createElement("div");
            chartDiv.id = "penData";
            chartDiv.setAttribute("class", "wellpumptype-chart");
            var chartCanvas = document.createElement("canvas");
            chartCanvas.id = "penCanvas";
            chartCanvas.setAttribute("class", "wellpumptype-chartcanvas");
            chartDiv.appendChild(chartCanvas);
            this.rootElement.appendChild(chartDiv);
          }
          this.queryHelper(smip.queries.getAttributesForEquipmentById(this.instanceId), this.renderUI);
        }  
      });
    },
    loadMachines: function(callBack) {
      this.queryHelper(smip.queries.getEquipmentsByTypeName(this.smipTypeName, config.app.modelParentId), function(payload) {
        appFramework.showMachines(payload, this.typeName);
      }.bind(this));
    },
    update: function() {
      if (this.ready) {
        logger.info("Processing update request on WellPump detail pane at " + new Date().toString());
        this.getPenData();
        this.getGaugeData();
      } else {
        logger.info("Ignoring update request on WellPump detail pane since not ready");
      }
    },
    destroy: function() {
      if (this.wellpumpChart != null)
        this.wellpumpChart.destroy();
      this.chartData.datasets = [];
      this.wellpumpChart = null;
      this.gauges = [];
      if (document.getElementById("gaugesDiv") != null) 
        document.getElementById("gaugesDiv").remove();
      if (document.getElementById("penData") != null) 
        document.getElementById("penData").remove();
      while (this.rootElement.firstChild) {
        this.rootElement.removeChild(this.rootElement.lastChild);
      }     
    },

    /* Private implementation-specific methods */
    renderUI: function(payload, query, self) {
      self.pens = self.parsePens(payload);
      self.gauges = self.parseGaugeAttr(payload);
      self.renderChart();
      self.renderGauges();
      //Tell container we're ready for updates
      this.ready = true;
      self.update();
    },
    parsePens:function(payload) {
      var discoveredPens = [];
      if (payload && payload.data && payload.data.attributes) {
        for (var c=0;c<payload.data.attributes.length;c++) {
          var child = payload.data.attributes[c];
          if (Object.keys(this.trends).indexOf(child.relativeName) != -1)
            discoveredPens.push( {"id": child.id, "displayName": child.displayName, "relativeName": child.relativeName, "timestamps":[], "samples": []} );
        }
      } else {
        logger.error("Payload did not conform to Profile and cannot be rendered!");
      }
      return discoveredPens;
    },
    getPenData: function() {
      // Pause updates until this one is processed
      this.ready = false;
      // Determine time range
      var endtime = new Date(Date.now());
      var two_hours_ms = 1*10*60*1000 ;
      var starttime = new Date(endtime - two_hours_ms);
      var datatype = "floatvalue";

      // Build the list of attributes (pens) to be updated
      var attrIds = [];
      this.pens.forEach((pen) => {
        if (Object.keys(this.trends).indexOf(pen.relativeName) != -1) {
          attrIds.push(pen.id);
        }
      });
      var attrIds = attrIds.join("\",\"");
      //Make one history query for all attributes
      var theQuery = smip.queries.getHistoricalData(attrIds, starttime.toISOString(), endtime.toISOString(), datatype);
      this.queryHelper(theQuery, this.processChartSamples.bind(this));
    },
    processChartSamples: function(payload, query) {
      //logger.trace(payload);
      if (payload && payload.data && 
        payload.data.getRawHistoryDataWithSampling && 
        payload.data.getRawHistoryDataWithSampling.length > 0)
      { 
        for (var i=0, j=payload.data.getRawHistoryDataWithSampling.length; i<j; i++) {
          var element = payload.data.getRawHistoryDataWithSampling[i];
          var usePen = this.findPenForAttribId(element.id, this.pens);
          if (usePen != -1) {
            this.shiftPenSampleWindow(element.ts, element.floatvalue, usePen, this.pens, this.chartSampleCount);
            //find axis dataset in chart
            var found = false;
            for (var c=0;c<this.chartData.datasets.length;c++) {
              var dataSet=this.chartData.datasets[c];
              if (dataSet.label == this.pens[usePen].displayName) {
                //update dataset.data
                dataSet.data = this.pens[usePen].samples;
                logger.info("Updating chart data " + dataSet.label, JSON.stringify(dataSet.data));
                found = true;
              }
            }
            if (!found)
              logger.warn("Could not find chart axis data to update " + this.pens[usePen].displayName);
            //update chart!
            this.wellpumpChart.update();
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
    findPenForAttribId:function(attribId, pens) {
      for(var x=0;x<pens.length;x++) {
        if (pens[x].id == attribId) {
          return x;
        }
      }
      return -1;
    },
    shiftPenSampleWindow:function(ts, value, index, pens, count) {
      //Rules:
      // #1 Keep timestamps and samples aligned!
      // #2 Don't push if timestamp is the same as previous time stamp
      //     Note: Comparing times is hell in Javascript, turn them into strings
      var ts1 = "T" + ts;
      var ts2 = "T" + pens[index].timestamps[pens[index].timestamps.length-1];
      //if (ts1 != ts2) {
        pens[index].samples.push(value);
        pens[index].timestamps.push(ts);  
      //} else {
      //  logger.info("Not charting repeated timestamp!");
      //}
      // #3 Keep number of charted samples below count
      if (pens[index].samples.length > count) { 
        pens[index].samples.shift();
        pens[index].timestamps.shift();
      }
    },
    renderChart: function() {
      var chartRoot = document.getElementById('penCanvas');
      this.chartData.datasets = [];
      for (var x=0;x<this.pens.length;x++) {      
        logger.info("pushing new pen to chart " + this.pens[x].displayName);
        useColor = this.chartColors;
        this.chartData.datasets.push({
          label: this.pens[x].displayName,
          data: [],
          fill: false,
          backgroundColor: Object.values(useColor),
          borderColor: Object.values(useColor),
          pointBackgroundColor: Object.values(useColor),
        })
      }
      this.wellpumpChart = new Chart(chartRoot,{
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
      var discoveredAttr = [];
      if (payload && payload.data && payload.data.attributes) {
        for (var c=0;c<payload.data.attributes.length;c++) {
          var child = payload.data.attributes[c];
          if (Object.keys(this.indicators).indexOf(child.relativeName) != -1) {
            gaugeMax = Object.keys(this.indicators[child.relativeName]).length -1;
            discoveredAttr.push( { id:child.id, gauge:null, maxValue:gaugeMax, relativeName: child.relativeName, displayName:child.displayName } );
          }
        }
      }
      return discoveredAttr;
    },
    getGaugeData() {
      // Pause updates until this one is processed
      this.ready = false;
      // Determine time range
      var endtime = new Date(Date.now());
      var two_hours_ms = 1*10*60*1000 ;
      var starttime = new Date(endtime - two_hours_ms);
      var datatype = 'intvalue';
      // Build the list of attributes (pens) to be updated
      var attrIds = [];
      var test = 0;
      this.gauges.forEach((gauge) => {
        //if (test == 0) {
          attrIds.push(gauge.id);
          test = 1;
        //}
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
            if (element.id == gauge.id) {
              this.gauges[idx].gauge.set(element.intvalue);
              var label = this.indicators[gauge.relativeName][element.intvalue];
              document.getElementById(`gauge${idx}Value`).innerText = label;
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
            gaugeDiv.setAttribute("class", "wellpumptype-gauge");
            var gaugeLabel = document.createElement("div");
            gaugeLabel.id = `gauge${idx}Label`;
            gaugeLabel.innerText = gauge.displayName;
            gaugeLabel.setAttribute("class", "wellpumptype-gaugelabel");
            gaugeDiv.appendChild(gaugeLabel);
            var gaugeCanvas = document.createElement("canvas");
            gaugeCanvas.id = `gauge${idx}Canvas`;
            gaugeCanvas.setAttribute("class", "wellpumptype-gaugecanvas");
            gaugeDiv.appendChild(gaugeCanvas);
            var gaugeValue = document.createElement("div");
            gaugeValue.id = `gauge${idx}Value`;
            gaugeValue.innerText = "0";
            gaugeValue.setAttribute("class", "wellpumptype-gaugevalue");
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