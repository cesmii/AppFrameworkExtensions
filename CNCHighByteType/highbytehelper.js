logger.info("Loaded HighByte helper!");
highbyteHelper = {};
highbyteHelper.server = "http://localhost:8885/data/v1/";
highbyteHelper.token = "";

highbyteHelper.getInstances = function(modelName, callBack) {
    this.performHighByteAPICall("instances", "model=CNCBaseType", "GET", modelName, this.reformatJson, callBack);
}

highbyteHelper.performHighByteAPICall = async (method, query, verb, typeName, formatter, callBack) => {
    const url = highbyteHelper.server + method + "?" + query;
    logger.info("HighByte helper making API call to: " + url);

    const response = await fetch(url, {
        method: verb,
        headers: {
          'Content-Type': 'application/json'
        }
    });
    formatter(await response.json(), typeName, callBack)
}

highbyteHelper.reformatJson = function(payload, typeName, callBack) {
    logger.info("HighByte helper is reformatting API Response: " + JSON.stringify(payload));
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
        logger.info("HighByte helper reformatted API Response is now: " + JSON.stringify(newPayload))
        callBack(newPayload, typeName);
    }
    else {
        callBack(payload, typeName);
    }
}