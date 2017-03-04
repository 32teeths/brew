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

// Firebase Config
// Initialize Firebase
console.log(JSON.parse(process.env.firebaseConfig));

firebase.initializeApp(JSON.parse(process.env.firebaseConfig));

console.log(firebase.app().name);  // "[DEFAULT]"

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
            console.log(response);
            // firebase.database().ref('app/config').set(response);
            console.log("Got success");
            res.send("Success!")
        }
    })
});

// interactive buttons hit this url
app.post('/coffee', urlencodedParser, (req, res) => {
    var reqBody = JSON.parse(req.body.payload);
    res.status(200).end() // respond with 200

    // base url is appended with todays date
    var base_url = 'coffee_times/' + moment().format('DD-MM-YYYY');

    // Todays list
    var newEntry = firebase.database().ref(base_url).push();

    var count = 0;

    // Get and Save total count for today
    firebase.database().ref(base_url + '/count/' + reqBody.actions[0].value).once('value').then(function (snapshot) {
        count = snapshot.val() || 0;
        console.log(snapshot.val());
    });

    // if its not neither increment the value
    if (reqBody.actions[0].value != 'neither') {
        console.log(count, 'count');
        firebase.database().ref(base_url + '/count/' + reqBody.actions[0].value).update({ count: count + 1 });
    }

    // Push to array 
    newEntry.set({ user: reqBody.user.name, choice: reqBody.actions[0].value, object: reqBody });

    var responseURL = reqBody.response_url
    if (validRequest(reqBody, res)) {
        sendMessageToSlackResponseURL(responseURL, { replace_original: true, text: 'Well , hello that is saved' });
        var url = 'https://slack.com/api/chat.postMessage?token=' + process.env.token + '&channel=C3J6S2HGB&text=Helo&pretty=1';
        request.get(url);
    }
});

app.post('/ask', urlencodedParser, (req, res) => {
    res.status(200).end() // best practice to respond with empty 200 status code
    var reqBody = req.body
    var responseURL = reqBody.response_url;

    if (validRequest(reqBody, res)) {

        // interactive buttons
        var message = {
            "token": process.env.token,
            "text": "Hello Hero , Fancy a cup of coffee or tea",
            "attachments": [
                {
                    "text": "A Coffee a day keeps the sleepy head away",
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
        request.get('https://slack.com/api/channels.info?token=' + process.env.token + '&channel=C3J6S2HGB&pretty=1', function (error, status, response) {
            // Get all the members in the general channel
            var members = JSON.parse(response).channel.members;
            // iterate throught the members 
            members.forEach(function (member) {
                // Open the channel for each user
                request.get('https://slack.com/api/im.open?token=' + process.env.token + '&user=' + member + '&pretty=1', function (error, status, response) {
                    // Send the interactive buttons
                    message.channel = JSON.parse(response).channel.id;
                    request.post('https://slack.com/api/chat.postMessage', { form: message }, function (error, status, response) {
                        // request.get('https://slack.com/api/chat.postMessage?token=' + process.env.token + '&channel=' + JSON.parse(response).channel.id + '&attachments=' + encodeURIComponent(JSON.stringify(message.attachments)), function (error, status, response) {
                        console.log(response);
                    })
                });

            })
        });
        // sendMessageToSlackResponseURL(responseURL, message)
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

// Start listening  
app.listen(process.env.PORT || 8000);
