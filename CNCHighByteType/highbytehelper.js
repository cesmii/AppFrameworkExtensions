logger.info("Loaded HighByte helper!");
highbyteHelper = {};
highbyteHelper.server = "http://localhost:8885/data/v1/";
highbyteHelper.token = "";

highbyteHelper.getInstances = function(modelName, callBack) {
    this.performHighByteAPICall("instances", "model=CNCBaseType", "GET", modelName, this.reformatEquipmentJson, callBack);
}

highbyteHelper.getInstanceData = function(modelName, instanceName, callBack) {
    this.performHighByteAPICall("instances/" + instanceName + "/value", null, "GET", modelName, null, callBack);
}

highbyteHelper.performHighByteAPICall = async (method, query, verb, typeName, formatter, callBack) => {
    var url = highbyteHelper.server + method;
    if (query)
        url += "?" + query;
    logger.info("HighByte helper making API call to: " + url);

    const response = await fetch(url, {
        method: verb,
        headers: {
          'Content-Type': 'application/json'
        }
    });
    var payload = await response.json();
    if (formatter)
        formatter(payload, typeName, callBack);
    else {
        if (callBack)
            callBack(payload, typeName);
    }
}

highbyteHelper.reformatEquipmentJson = function(payload, typeName, callBack) {
    logger.info("HighByte helper is reformatting Model API Response: " + JSON.stringify(payload));
    if (payload.instances) {
        const newPayload = {
            data: {
                equipments: []
            }
        }
        payload.instances.forEach(instance => {
            newPayload.data.equipments.push( { 
                displayName: instance,
                typeName: typeName,
                id: instance
            });
        });
        logger.info("HighByte helper reformatted Model API Response is now: " + JSON.stringify(newPayload))
        if (callBack)
            callBack(newPayload, typeName);
    }
    else {
        if (callBack)
            callBack(payload, typeName);
    }
}