typeSupportHelpers.push(cnchighbitetype = {
    /* IDetailPane Interface Properties */
    typeName: "cnchighbytetype",
    rootElement: null,
    instanceId: null,
    queryHelper: null,

    /* Private implementation-specific properties */
    ready: false,
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
      logger.info("Activating cnchighbytetype detail pane!");
      include("TypeSupport/cnchighbytetype/gauge.js");
      include({ 
        src:"https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js",
        integrity: "sha512-ElRFoEQdI5Ht6kZvyzXhYG9NqjtkmlkfYk0wr6wHxU9JEHakS7UJZNeml5ALk+8IKlU6jDgMabC3vkumRokgJA==",
        crossOrigin: "anonymous",
        referrerpolicy:"no-referrer"
      }, () => {
        /*add elements to DOM once dependency scripts are loaded*/
        logger.info("Dependencies loaded for cnchighbytetype, initializing UI.")
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
            chartDiv.setAttribute("class", "cnchighbytetype-chart");
            var chartCanvas = document.createElement("canvas");
            chartCanvas.id = "axisCanvas";
            chartCanvas.setAttribute("class", "cnchighbytetype-chartcanvas");
            chartDiv.appendChild(chartCanvas);
            this.rootElement.appendChild(chartDiv);
          }
          highbyteHelper.getInstanceData(this.typeName, this.instanceId, this.renderUI.bind(this));
        }
      });
    },
    loadMachines: function(callBack) {
      logger.info("Calling HighByte helper!");
      highbyteHelper.getInstances(this.typeName, callBack);
      this.ready = true;
    },
    update: function() {
      if (this.ready) {
        logger.info("Processing update request on HighByte CNC detail pane at " + new Date().toString());
        highbyteHelper.getInstanceData(this.typeName, this.instanceId, this.processUpdateData.bind(this));
      } else {
        logger.info("Ignoring update request on HighByte CNC detail pane since not ready");
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
    renderUI: function(payload, query) {
      logger.info("cncnhighbytetype parsing payload: " + JSON.stringify(payload));
      this.axes = this.parseAxis(payload);
      this.gauges = this.parseGaugeAttr(payload);
      this.renderAxisChart();
      this.renderGauges();
      //Tell container we're ready for updates
      this.ready = true;
      this.update();
    },
    parseAxis:function(payload) {
      var discoveredAxis = [];
      if (payload && payload.AxisList && Array.isArray(payload.AxisList)) {
        for (var c=0;c<payload.AxisList.length;c++) {
          axis = payload.AxisList[c];
          logger.info("parsing axis: " + JSON.stringify(axis));
          discoveredAxis.push( {"displayName":axis.Id, "equipmentId": axis.Id, "attributes": null, "timestamps":[], "samples": []});
        }
      }
      return discoveredAxis;
    },
    findAxisForId:function(axisId, axes) {
      for(var x=0;x<axes.length;x++) { 
        if (axes[x].equipmentId == axisId)
          return x;
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
      var discoveredAttr = [];

      if (payload && payload.SpindleList && Array.isArray(payload.SpindleList)) {
        for (var c=0;c<payload.SpindleList.length;c++) {
          spindle = payload.SpindleList[c];
          toolInfo = payload.ToolInformation;
          logger.info("parsing spindle: " + JSON.stringify(spindle));
          if (spindle.Id && spindle.Motor && spindle.Motor.LoadRate)
            discoveredAttr.push({attrid:"LoadRate", gauge:null, maxValue:100, name: "Load Rate"});
          if (toolInfo.ToolStatus && toolInfo.ToolStatus && toolInfo.ToolStatus.FeedRate)
            discoveredAttr.push({attrid:"FeedRate", gauge:null, maxValue:25, name: "Feed Rate"});
          if (spindle.Id && spindle.Motor && spindle.Motor.RPM)
            discoveredAttr.push({attrid:"RPM", gauge:null, maxValue:1000, name: "RPM"});  
        }
      }
      return discoveredAttr;
    },
    processUpdateData: function(payload, query) {
      logger.info("processing data!");
      this.ready = false;
      logger.info("gauge payload now: " + JSON.stringify(payload));
      this.gauges.forEach((gauge, idx) => {
        logger.info("Updating gauge data " + gauge.attrid);
        if (payload.SpindleList[0].Motor[gauge.attrid]) {
          logger.info("gauge value should be: " + payload.SpindleList[0].Motor[gauge.attrid]);
          this.gauges[idx].gauge.set(payload.SpindleList[0].Motor[gauge.attrid]);
          document.getElementById(`gauge${idx}Value`).innerText = payload.SpindleList[0].Motor[gauge.attrid];
        }
        if (gauge.attrid == "FeedRate") {
          logger.info("gauge value should be: " + payload.ToolInformation.ToolStatus.FeedRate);
          this.gauges[idx].gauge.set(payload.ToolInformation.ToolStatus.FeedRate);
          document.getElementById(`gauge${idx}Value`).innerText = payload.ToolInformation.ToolStatus.FeedRate;
        }
      })
      logger.info("chart payload now: " + JSON.stringify(payload));
      logger.info("this axes are: " + JSON.stringify(this.axes));
      if (payload && payload.AxisList && Array.isArray(payload.AxisList))
      { 
        for (var i=0, j=payload.AxisList.length; i<j; i++) {
          var element = payload.AxisList[i];
          element.ts = new Date().getTime()
          element.floatvalue = element.Offset;
          logger.info("examing axis: " + JSON.stringify(element));
          var useAxis = this.findAxisForId(element.Id, this.axes);
          logger.info("this axis is: " + JSON.stringify(useAxis));
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
      return;
    },
    renderGauges: function() {
      var gaugesRoot = document.getElementById("gaugesDiv");
      this.gauges.forEach((gauge, idx) => {
        if (document.getElementById(`gauge${idx}Div`) == null) {
            var gaugeDiv = document.createElement("div");
            gaugeDiv.id = `gauge${idx}Div`;
            gaugeDiv.setAttribute("class", "cnchighbytetype-gauge");
            var gaugeLabel = document.createElement("div");
            gaugeLabel.id = `gauge${idx}Label`;
            gaugeLabel.innerText = gauge.name;
            gaugeLabel.setAttribute("class", "cnchighbytetype-gaugelabel");
            gaugeDiv.appendChild(gaugeLabel);
            var gaugeCanvas = document.createElement("canvas");
            gaugeCanvas.id = `gauge${idx}Canvas`;
            gaugeCanvas.setAttribute("class", "cnchighbytetype-gaugecanvas");
            gaugeDiv.appendChild(gaugeCanvas);
            var gaugeValue = document.createElement("div");
            gaugeValue.id = `gauge${idx}Value`;
            gaugeValue.innerText = "0";
            gaugeValue.setAttribute("class", "cnchighbytetype-gaugevalue");
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
});
