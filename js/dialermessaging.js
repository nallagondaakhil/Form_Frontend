// This example snippet assumes the existence of a helper
// method for sending a request to the active ICWS session.
var sendRequest = function(httpMethod, path, requestPayload, responseCallback) { 
	
	$.ajax({
		url: baseURL+"/icws/connection",
		headers: {
			'Accept-Language':'en-us',
			'Content-Type':'application/json'
		},
		indexValue: callback,
		method: httpMethod,
		dataType: 'json',
		data: JSON.stringify(connectionRequestSettings),
		success: function(data){
			console.log('---------------------------------------------------');
			console.log(data);
			icwsConnectionInfo = data;
			if(this.indexValue!=undefined && this.indexValue!=null){
				this.indexValue();
			}
		}
	});

};

// This example snippet assumes the existence of a helper function:
// A function determining whether server-sent events messaging is supported by inspecting the messaging feature version (supported in messaging version 2).
var isServerSentEventsSupportedOnServer = function() {return true;};

// Dictionary of ICWS message __type ID to the callback (type: icwsMessageCallback)
// to invoke when that message is received.
var icwsMessageCallbacks = {};
var messageProcessingTimerId;
var eventSourceInstance;

// Polling interval for retrieving ICWS message queue.
var ICWS_MESSAGE_RETRIEVAL_INTERVAL_MS = 1000;

/**
 * Sets the callback for a particular type of ICWS message.
 * @param {String} messageType The ICWS message type. (ex: urn:inin.com:status:userStatusMessage)
 * @param {icwsMessageCallback} messageCallback The callback to invoke with the message details.
 * @throws {Error} The messageCallback was undefined.
 * @throws {Error} A callback is already registered for the specified messageType.
 */
function registerMessageCallback(messageType, messageCallback) {
    if (messageCallback === undefined) {
        throw new Error('Invalid argument "messageCallback".');
    }
    
    if (!icwsMessageCallbacks[messageType]) {
        icwsMessageCallbacks[messageType] = messageCallback;
    } else {
        throw new Error('Message callback already registered for message type: ' + messageType);
    }
};

/**
 * Handles eventSourceInstance's message event and relays it to the correct callback.
 * @param {Event} event The onmessage event data.
 * @see stopMessageProcessing
 */
var onServerSentEventMessage = function(event) {
    var message, messageType, messageCallback;
	console.log("-------event-------");
	console.log(event);
    try {
       // Process the data off of the event. It is a JSON string.
       var message = JSON.parse(event.data);
       messageType = message.__type;
 
       // Invoke a registered message callback if there is one.
       messageCallback = icwsMessageCallbacks[messageType];
       if (messageCallback) {
           messageCallback(message);
       } else {
           // No registered message handler.
       }
    }
    catch (error) {
       // Failed to process message.
    }
}

/**
 * Starts the message processing mechanism, if not already running.
 * @see stopMessageProcessing
 */
function startMessageProcessing() {
    if (isServerSentEventsSupportedOnServer() && typeof EventSource !== 'undefined') {
        if (!eventSourceInstance || eventSourceInstance.readyState === EventSource.CLOSED) {
            var messagingUrl = ININ.Addins.IC.getIcwsBaseUrl() +"/icws/"+icwsConnectionInfo["sessionId"] +"/messaging/messages";
 
            eventSourceInstance = new EventSource(messagingUrl, {
                withCredentials: true // Allows the Cookie HTTP request header to be sent
            });
 
            eventSourceInstance.onmessage = onServerSentEventMessage;
        }
    } else {
        // Only send the next request once the previous result has been received.
        function runTimerInstance() {
            messageProcessingTimerCallback();
            messageProcessingTimerId = setTimeout(runTimerInstance, ICWS_MESSAGE_RETRIEVAL_INTERVAL_MS);
        }
        
        if (!messageProcessingTimerId) {
            runTimerInstance();
        }
    }
}

/**
 * Stops the message processing mechanism, if running.
 * @see startMessageProcessing
 */
function stopMessageProcessing() {
    if (eventSourceInstance) {
        if (eventSourceInstance.readyState !== EventSource.CLOSED) {
            eventSourceInstance.stop();
        }
    } else if (!!messageProcessingTimerId) {
        clearTimeout(messageProcessingTimerId);
        messageProcessingTimerId = null;
    }
}

/**
 * Implements the message processing mechanism timer callback.
 * @see startMessageProcessing
 * @see stopMessageProcessing
 */
function messageProcessingTimerCallback() {
    var payload, messageIndex, messageCount, jsonMessage, messageType, messageCallback;
    
    // The messaging GET request does not take any payload values.
    payload = {};

    sendRequest('GET', '/messaging/messages', payload, function(status, jsonResponse) {
        if ((status >= 200) && (status <= 299)) {
            // Process retrieved messages.
            messageCount = jsonResponse.length;
            for (messageIndex = 0; messageIndex < messageCount; messageIndex++) {
                jsonMessage = jsonResponse[messageIndex];
                messageType = jsonMessage.__type;
                
                // For each message, invoke a registered message callback if there is one.
                messageCallback = icwsMessageCallbacks[messageType];
                if (messageCallback) {
                    messageCallback(jsonMessage);
                } else {
                    // No registered message handler.
                }
            }
        }
    });
    
 
}