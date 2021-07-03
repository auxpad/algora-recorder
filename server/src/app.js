//Imports
const path = require("path");
const express = require("express");
const app = express();
const router = express.Router();
const https = require('https');
const dotenv = require('dotenv');
const expressStaticGzip = require ('express-static-gzip');


var cors = require("cors");
app.use(cors());
app.use(express.static('../client/build'));

const server = require("http").createServer(app);
const io = require("socket.io")(server ,{
	cors: {
		origin: '*',
	}
});

io.path("/api");
const fs = require("fs");
// Google Cloud
const speech = require("@google-cloud/speech").v1p1beta1;
const speechClient = new speech.SpeechClient(); // Creates a client

//=================== SOCKET SERVICE =================

io.of("/api").on("connection", function (client) {
	console.log("Client Connected to server");
	let recognizeStream = null;

	let id = null
	client.on("join", function (data) {
		console.log(data.id)
		id = data.id
		client.join(data.id)
		client.to(data.id).emit("messages", "Socket Connected to Server");
	});




	client.on("messages", function (data) {
		client.to(id).emit("broad", data);
	});


	client.on("startGoogleCloudStream", (data) => {
		startRecognitionStream(this, data);
	});

	client.on("endGoogleCloudStream", function (data) {
		stopRecognitionStream();
	});

	client.on("binaryData", function (data) {
		// console.log(data); //log binary data
		if (recognizeStream !== null) {
			recognizeStream.write(data);
		}
	});

	function startRecognitionStream(client, data) {
		let languageCode = 'en-US'

		// TODO: USE CUSTOM DATA
		try {
			console.log("Data received: " + data.userName) 
		}
		catch (e) {
			console.log("Could not find language code")
		}

		let encoding = "LINEAR16";
		let sampleRateHertz = 16000;

		let request = {
			config: {
				encoding: encoding,
				sampleRateHertz: sampleRateHertz,
				languageCode: languageCode,
				profanityFilter: false,
				enableWordTimeOffsets: true,
				enableAutomaticPunctuation: true
			},
			interimResults: true,
			single_utterance: false,
			enableAutomaticPunctuation: true,
		};



		recognizeStream = speechClient
			.streamingRecognize(request)
			.on("error", console.error)
			.on("data", (data) => {
				process.stdout.write(
					data.results[0] && data.results[0].alternatives[0]
						? `Transcription: ${data.results[0].alternatives[0].transcript}\n`
						: `\n\nReached transcription time limit, press Ctrl+C\n`
				);
				try {
					client.to(id).emit("speechData", data);
				} catch (e) {
					console.log(e)
				}

				// If end of utterance, let's restart stream
				if (data.results[0] && data.results[0].isFinal) {
					stopRecognitionStream();
					console.log('Stopped streaming');
					client.to(id).emit('stopped', '');
				}
			});
	}

	// STOP RECOGNITION STREM
	function stopRecognitionStream() {
		if (recognizeStream) {
			recognizeStream.end();
		}
		recognizeStream = null;
	}
});


// PORT CONFIGURATION
const port = process.env.PORT || 8080;


// PORT LISTENING
server.listen(port, () => {
	console.log("Server is up on port ", port);
});
