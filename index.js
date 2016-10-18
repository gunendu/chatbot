'use strict'

const express = require('express')
const bodyParser = require('body-parser')
const request = require('request')
const app = express()

app.set('port', (process.env.PORT || 5000))

// Process application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({extended: false}))

// Process application/json
app.use(bodyParser.json())

// Index route
app.get('/', function (req, res) {
    res.send('Hello world, I am a chat bot')
})

// for Facebook verification
app.get('/webhook/', function (req, res) {
    if (req.query['hub.verify_token'] === 'my_voice_is_my_password_verify_me') {
        res.send(req.query['hub.challenge'])
    }
    res.send('Error, wrong token')
})

app.post('/webhook/', function (req, res) {
    var data = req.body
    if(data.object == 'page') {
      data.entry.forEach(function(pageEntry) {
      var pageID = pageEntry.id;
      var timeOfEvent = pageEntry.time;

      // Iterate over each messaging event
      pageEntry.messaging.forEach(function(messagingEvent) {
        if (messagingEvent.optin) {
          receivedAuthentication(messagingEvent);
        } else if (messagingEvent.message) {
          receivedMessage(messagingEvent);
        } else if (messagingEvent.postback) {
          receivedPostback(messagingEvent);
        } else {
          console.log("Webhook received unknown messagingEvent: ", messagingEvent);
        }
      });
    });
    }
    res.sendStatus(200)
  })

 function receivedMessage(event) {
   var senderID = event.sender.id;
   var recipientID = event.recipient.id;
   var timeOfMessage = event.timestamp;
   var message = event.message;

   console.log("Received message for user %d and page %d at %d with message:",
     senderID, recipientID, timeOfMessage);
   console.log(JSON.stringify(message));

   var messageId = message.mid;

   // You may get a text or attachment but not both
   var messageText = message.text;
   var messageAttachments = message.attachments;

   if (messageText) {

     // If we receive a text message, check to see if it matches any special
     // keywords and send back the corresponding example. Otherwise, just echo
     // the text we received.
     switch (messageText) {
       case 'image':
         sendImageMessage(senderID);
         break;

       case 'button':
         sendButtonMessage(senderID);
         break;

       case 'generic':
         sendGenericMessage(senderID);
         break;

       case 'receipt':
         sendReceiptMessage(senderID);
         break;

       default:
         sendTextMessage(senderID, messageText);
     }
   } else if (messageAttachments) {
     console.log("messageAttachments",messageAttachments);
     var lat = messageAttachments[0].payload.coordinates.lat;
     var long = messageAttachments[0].payload.coordinates.long;
     callUberApi(lat,long,senderID,function(error,body){
       if(!error) {
         var messageData = formGenericMessage(body,senderID);
         callSendAPI(messageData);
         sendTextMessage(senderID, "Message with attachment received");
       }
     });
   }
 }

function sendTextMessage(recipientId, messageText) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: messageText
    }
  };
  callSendAPI(messageData);
}

function callSendAPI(messageData) {
  request({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token: PAGE_ACCESS_TOKEN },
    method: 'POST',
    json: messageData
  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var recipientId = body.recipient_id;
      var messageId = body.message_id;

      console.log("Successfully sent generic message with id %s to recipient %s",
        messageId, recipientId);
    } else {
      console.error("Unable to send message.");
      console.error(error);
    }
  });
}

function formGenericMessage(body,senderID) {
  var products = body.products;
  console.log("products",products,typeof(products));
  var messageData = {}
  var message = {};
  var attachment = {};
  var elements = [];
  var payload = {};
  var recipient = {};
  var buttons = [];
  payload.template_type = "generic";
  recipient.id = senderID;
  messageData.recipient = recipient;
  var button = {
    type: "web_url",
    url: "https://www.oculus.com/en-us/rift/",
    title: "Open Web URL"
  };
  buttons.push(button);
  for (var index in products) {
    console.log("for each product",products[index]);
    var product = products[index];
    var element = {};
    element.title= product.display_name,
    element.subtitle= product.description,
    element.item_url= "https://www.uber.com/en-IN/",
    element.image_url= product.image,
    element.buttons = buttons
    elements.push(element);
  }
  payload.elements = elements;
  attachment.type = "template";
  attachment.payload = payload;
  message.attachment = attachment;
  messageData.recipient = recipient;
  messageData.message = message;
  return messageData;
}

function receivedPostback(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfPostback = event.timestamp;

  // The 'payload' param is a developer-defined field which is set in a postback
  // button for Structured Messages.
  var payload = event.postback.payload;

  console.log("Received postback for user %d and page %d with payload '%s' " +
    "at %d", senderID, recipientID, payload, timeOfPostback);

  if(payload.indexOf("START_ORDER") > -1) {
     var messageData = askLocation(senderID);
     callSendAPI(messageData);
  }
  // When a postback is called, we'll send a message back to the sender to
  // let them know it was successful
  sendTextMessage(senderID, "Postback called");
}

function askLocation(senderID) {
  var messageData = {};
  var recipient = {};
  var message = {};
  var quick_replies = [];
  recipient.id = senderID;
  message.text = "Please share your location:";
  quick_replies.push({"content_type":"location"});
  message.quick_replies = quick_replies;
  messageData.recipient = recipient;
  messageData.message = message;
  return messageData;
}

function callUberApi(lat,long,senderID,callback){
  var url = "https://api.uber.com/v1/products?latitude="+lat+"&longitude="+long;
  console.log("url is",url);
  request.get({
    url: url,
    headers: {
      "Authorization": "Token " + TOKEN
    }
  }, function(error,response,body){
        console.log("error is",error);
        if(!error) {
          var body = JSON.parse(body);
          console.log("body callUberApi",body);
          callback(null,body);
        }
  });
}

const PAGE_ACCESS_TOKEN = "EAAJlIf8qzEYBAAmO0HQLdhFZCiFnH1EUKZCt80SnIlPZCRJidmBCFQwllotIBWAK4fzhkDhFN5BFbEGYWQrjh1BIBOspXBKMMsAffNMLau7DZAfLTfjHZA3ZBZAhF7EQ3ovV6bhqeTyj5ZBjifswCAJg4U9kZB0JHsZBv5fEpRfnZB9mQZDZD"
const TOKEN = "rOTkxK0vljzip_2yKeONQmB37QZTMCFmvxmzdhAv"

// Spin up the server
app.listen(app.get('port'), function() {
    console.log('running on port', app.get('port'))
})
