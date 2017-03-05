/*
Brew is an attempt to build a bot using the Slack api
Have used Firebase to store the content 
*/

var express = require('express')
var request = require('request')
var bodyParser = require('body-parser')
var app = express()
var urlencodedParser = bodyParser.urlencoded({ extended: false })

var firebase = require("firebase");
var moment = require('moment');
var count;

// Initialize Firebase
firebase.initializeApp(JSON.parse(process.env.firebaseConfig));

// Endpoint to enable OAuth access for the app
app.get('/OAuth', (req, res) => {
    var options = {
        uri: 'https://slack.com/api/oauth.access?code='
        + req.query.code +
        '&client_id=' + process.env.clientId +
        '&client_secret=' + process.env.clientSecret +
        '&redirect_uri=' + 'https://slackbrew.herokuapp.com/OAuth' +
        '&scope=incoming-webhook,commands,bot,chat.update',
        method: 'GET'
    }
    // Redirect the request to url ,with the required params
    request(options, (error, response, body) => {
        var JSONresponse = JSON.parse(body)
        if (!JSONresponse.ok) {
            res.send("Error encountered: \n" + JSON.stringify(JSONresponse)).status(200).end()
        } else {
            // Its better to store the token in firebase for later use
            firebase.database().ref('app/config').set(response);
            res.send("Success!")
        }
    })
});

// any actions on interactive buttons hit this url
app.post('/choice', urlencodedParser, (req, res) => {
    var reqBody = JSON.parse(req.body.payload);

    // base url is appended with todays date
    var base_url = 'day/' + moment().format('DD-MM-YYYY');

    // Validate the request
    if (validRequest(reqBody, res)) {

        // Todays list
        var newEntry = firebase.database().ref(base_url).push();

        // Push to array 
        newEntry.set({ user: reqBody.user.name, choice: reqBody.actions[0].value, object: reqBody });

        // Increment the count for the day
        firebase.database().ref(base_url + '/count').once('value').then(function (snapshot) {
            count = snapshot.val() || {};
            // if its not neither increment the value
            if (reqBody.actions[0].value != 'neither') {
                count[reqBody.actions[0].value] = count[reqBody.actions[0].value] || 0;
                count[reqBody.actions[0].value]++;

                // Message that will send to channel
                var message = {
                    "text": count.coffee + " Coffee and " + count.tea + " Tea will be served. \nGood Day guys! "
                }

                var responseURL = reqBody.response_url
                // send message to channel
                sendMessageToSlackResponseURL(responseURL, { replace_original: true, text: 'Roger that!.' });

                // for the first time we should postMessage , else update
                if (!count.ts) {
                    var url = 'https://slack.com/api/chat.postMessage?token=' + process.env.token + '&channel=C3J6S2HGB&text=' + encodeURIComponent(JSON.stringify(message.text)) + '&pretty=1';
                    request.get(url, function (status, response, body) {

                        // save the timestamp of the message for update
                        count.ts = JSON.parse(body).ts;
                        // Save the count to firebase
                        firebase.database().ref(base_url + '/count').update(count);
                    });
                } else {
                    var url = 'https://slack.com/api/chat.update?token=' + process.env.token + '&channel=C3J6S2HGB&ts=' + count.ts + '&text=' + encodeURIComponent(JSON.stringify(message.text)) + '&pretty=1';
                    // Update the message on channel
                    request.get(url, function (status, response, body) {
                        firebase.database().ref(base_url + '/count').update(count);
                    });
                }
            }
            res.status(200).end() // respond with 200
        });
    }
});

/**
 * Function will post the JSON message to the response_url
 * 
 * @param {any} responseURL
 * @param {any} JSONmessage
 */
function sendMessageToSlackResponseURL(responseURL, JSONmessage) {
    var postOptions = {
        uri: responseURL,
        method: 'POST',
        headers: {
            'Content-type': 'application/json'
        },
        json: JSONmessage
    }
    return request(postOptions, (error, response, body) => {
        if (error) {
            // handle errors as you see fit
        }
    })
};

/**
 * Function validates every request
 * 
 * @param {any} reqBody
 * @param {any} res
 */
function validRequest(reqBody, res) {
    if (reqBody.token != process.env.verificationToken) {
        res.status(403).end("Access forbidden")
        return false;
    } else {
        return true
    }
}


// @todo this is triggered by a slash command , 
// should instead be triggered by a scheduler
app.post('/ask', urlencodedParser, (req, res) => {
    var reqBody = req.body
    var responseURL = reqBody.response_url;

    if (validRequest(reqBody, res)) {
        // Send buttons to everybody in the channel
        sendButtons('C3J6S2HGB');
        res.status(200).end();
    }
});

// API to trigger the interactive button
app.get('/trigger', urlencodedParser, (req, res) => {
    sendButtons('C3J6S2HGB');//C3J6S2HGB is the channel of general channel
    res.send('Buttons triggered');
});

/**
 * Function will send interactive buttons to everybody in the channel
 * 
 * @param {any} channel
 */
function sendButtons(channel) {
    // interactive buttons
    var message = {
        "text": "Hello there !, Fancy a cup of coffee/tea?",
        "attachments": [
            {
                "text": "Choose one , not both :) ",
                "fallback": "Well, there are days it wouldnt work and unfortunately today is such a day.",
                "callback_id": "button_tutorial",
                "color": "#3AA3E3",
                "attachment_type": "default",
                "actions": [
                    {
                        "name": "yes",
                        "text": "Coffee",
                        "type": "button",
                        "value": "coffee"
                    },
                    {
                        "name": "no",
                        "text": "Tea",
                        "type": "button",
                        "value": "tea"
                    },
                    {
                        "name": "maybe",
                        "text": "Neither",
                        "type": "button",
                        "value": "neither",
                        "style": "danger"
                    }
                ]
            }
        ]
    }

    // Find the people in the general channel
    request.get('https://slack.com/api/channels.info?token=' + process.env.token + '&channel=' + channel + '&pretty=1', function (error, status, response) {
        // Get all the members in the general channel
        var members = JSON.parse(response).channel.members;
        // iterate throught the members 
        members.forEach(function (member) {
            // Open the channel for each user
            request.get('https://slack.com/api/im.open?token=' + process.env.token + '&user=' + member + '&pretty=1', function (error, status, response) {
                // Send the interactive buttons
                request.get('https://slack.com/api/chat.postMessage?token=' + process.env.token + '&channel=' + JSON.parse(response).channel.id + '&attachments=' + encodeURIComponent(JSON.stringify(message.attachments)), function (error, status, response) {
                    // Buttons send to every person in the channel .
                })
            });
        });
    });
}


// Start listening  
app.listen(process.env.PORT || 8000);
