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


// Firebase Config
// Initialize Firebase
console.log(JSON.parse(process.env.firebaseConfig));

firebase.initializeApp(JSON.parse(process.env.firebaseConfig));

// Endpoint to enable OAuth access for the app
app.get('/OAuth', (req, res) => {
    var options = {
        uri: 'https://slack.com/api/oauth.access?code='
        + req.query.code +
        '&client_id=' + process.env.clientId +
        '&client_secret=' + prcess.env.clientSecret +
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
            res.send("Success!")
        }
    })
});

app.post('/coffee', urlencodedParser, (req, res) => {
    var reqBody = JSON.parse(req.body.payload);
    res.status(200).end() // best practice to respond with 200 status

    // Todays list
    var newEntry = firebase.database().ref('coffee_times/' + moment().format('DD-MM-YYYY')).push();
    newEntry.set({ user: reqBody.user.name, choice: reqBody.actions[0].value, object: reqBody });

    var responseURL = reqBody.response_url
    if (validRequest(reqBody, res)) {
        sendMessageToSlackResponseURL(responseURL, { replace_original: true, text: 'Well , hello that is saved' });

        var url = 'https://slack.com/api/chat.postMessage?token=' + token + '&channel=C3J6S2HGB&text=Helo&pretty=1';

        request.get(url);
        console.log(url,'to hit');
        //https://slack.com/api/chat.postMessage?token=xoxp-120988635527-120375240740-145845048485-070b92ac9dfa33327a8d3e00e7cdd680&channel=C3J6S2HGB&text=ther%3F%20now%20&pretty=1
    }

});

app.post('/ask', urlencodedParser, (req, res) => {
    res.status(200).end() // best practice to respond with empty 200 status code
    var reqBody = req.body
    var responseURL = reqBody.response_url;

    if (validRequest(reqBody, res)) {
        var message = {
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
        sendMessageToSlackResponseURL(responseURL, message)
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
