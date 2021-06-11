import React, { Component } from 'react'
import socketIOClient from "socket.io-client";


let bufferSize = 2048,
	AudioContext,
	context,
	processor,
	input,
	globalStream,
	streamStreaming = false;

const constraints = {
	audio: true,
	video: false
};
let wholeStringTranscription = ''
const socket = socketIOClient(`http://localhost:8080/api`); // TODO: Node server


//================= SOCKET IO =================
let bleh_id = (Math.random() * (0.50 - 0.0200) + 0.0800).toFixed(10)
console.log("BLEH ID: " + bleh_id)
socket.on('connect', function (data) {
	// console.log(socket.id)
	socket.emit('join', {
		id: String(bleh_id)
	});
});

socket.on('messages', function (data) {
	console.log(data);
});


class Sttcomponent extends Component {

	constructor(props) {
		super(props);
		this.state = {
			recording: false,
			resultText: '',
			audio: '',
			status: 'OFFLINE',
		}
		this.onStart = this.onStart.bind(this);
		this.onStop = this.onStop.bind(this);
		this.updateData = this.updateData.bind(this);
	}

	handleChangeResultText(e) {
		this.setState({
			resultText: e.target.value
		});
	}

	updateData(data) {
		this.setState({ resultText: data });
	}


	AudioStreamer = {
		/**
		 * @param {function} onData Callback to run on data each time it's received
		 * @param {function} onError Callback to run on an error if one is emittedate.
		 */

		stopRecording: () => {
			stopRecording();
		}
	}


	initRecording() {
		let that = this;
		console.log("...start google cloud stream")
		socket.emit('startGoogleCloudStream', {
			userName: 'Yuvraj!', // TODO: ATTACH CUSTOM DATA
		});
		streamStreaming = true;
		AudioContext = window.AudioContext || window.webkitAudioContext;
		context = new AudioContext({
			latencyHint: 'interactive',
		});
		processor = context.createScriptProcessor(bufferSize, 1, 1);
		processor.connect(context.destination);
		context.resume();

		var handleSuccess = function (stream) {
			try {
				globalStream = stream;
				input = context.createMediaStreamSource(stream);
				input.connect(processor);

				processor.onaudioprocess = function (e) {
					microphoneProcess(e);
				};
			} catch (e) {

			}

		};

		navigator.mediaDevices.getUserMedia(constraints)
			.then((stream, err) => {
				console.log(err)
				console.log(stream)
				handleSuccess(stream)
			});
	}



	componentDidMount() {
		let that = this;
		socket.on('stopped', function (data) {
			console.log("Stopped streaming!")
		});

		socket.on('speechData', function (data) {
			// console.log(data.results[0].alternatives[0].transcript);
			var dataFinal = undefined || data.results[0].isFinal;

			// ====== PRINT ONLY IF EOS DETECTED ======
			// if (dataFinal === true) {
			// 	let wholeString = data.results[0].alternatives[0].transcript;
			// 	wholeStringTranscription = wholeString;
			// 	// console.log(wholeString)
			// 	document.getElementById("resultText").value += wholeString + ' ';
			// }
			// ======================================

			let wholeString = data.results[0].alternatives[0].transcript;
			wholeStringTranscription = wholeString;
			// console.log(wholeString)
			document.getElementById("resultText").value = wholeString;
		});

	}


	onStart() {

		this.resetRecord()
		this.setState({
			recording: true,
			status: "LISTENING..."
		});

		let tempLink = document.getElementById('startBeep');
		tempLink.src = "https://storage.googleapis.com/nabs-71a67.appspot.com/Text-Message-Acknowledgement-ThumbsDown.mp3";
		tempLink.setAttribute('notification', 'notification.mp3');
		tempLink.play();
		this.initRecording();
	}

	onStop() {
		try {
			this.AudioStreamer.stopRecording();
			// wholeStringTranscription = ''
		} catch (e) {
			window.alert(e.message)
		}


	}


	handleChange = (event) => {
		this.setState({ engine: event.target.value });
	}


	resetRecord() {
		this.setState({ recording: false, status: "OFFLINE" })
		try {
			this.AudioStreamer.stopRecording();
		} catch (e) {
			console.log("nothing to stop!")
		}
	}

	render() {
		return (
			<div style={{ "justifyContent": "center", "textAlign": "center", marginTop: "20vh" }}>
				<div className="text-center main">
					<h2 className="text-center">GCP STT</h2>
				</div>

				<div>
					<textarea placeholder="" className="form-control" id="resultText" />
					<br></br>
					<br />
				State: {this.state.status}
					<div>
						<div style={{ marginTop: "20px" }}>
							{this.state.recording === false ? <button className="btn btn-primary" type="" style={{ marginTop: "10px" }} onClick={() => {
								this.onStart()
							}}>
								Start
						 </button> :
								<button className="btn btn-danger" type="" style={{ marginTop: "10px" }} onClick={() => {
									this.resetRecord()
								}}>
									Stop
                         </button>}
							<audio id="startBeep" src="https://storage.googleapis.com/nabs-71a67.appspot.com/Purr.mp3"></audio>
						</div>
					</div>
				</div>
			</div>

		)
	}


}

export default Sttcomponent;




function microphoneProcess(e) {
	var left = e.inputBuffer.getChannelData(0);
	// socket.emit('binaryData', left);
	var left16 = downsampleBuffer(left, 44100, 16000)
	socket.emit('binaryData', left16);
}

window.onbeforeunload = function () {
	if (streamStreaming) {
		socket.emit('endGoogleCloudStream', {
			languageCode: 'en-IN'
		});
	}
};

//================= SANTAS HELPERS =================


var downsampleBuffer = function (buffer, sampleRate, outSampleRate) {
	if (outSampleRate === sampleRate) {
		return buffer;
	}
	if (outSampleRate > sampleRate) {
		return null;
	}
	var sampleRateRatio = sampleRate / outSampleRate;
	var newLength = Math.round(buffer.length / sampleRateRatio);
	var result = new Int16Array(newLength);
	var offsetResult = 0;
	var offsetBuffer = 0;
	while (offsetResult < result.length) {
		var nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
		var accum = 0, count = 0;
		for (var i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
			accum += buffer[i];
			count++;
		}

		result[offsetResult] = Math.min(1, accum / count) * 0x7FFF;
		offsetResult++;
		offsetBuffer = nextOffsetBuffer;
	}
	return result.buffer;
}


function stopRecording() {
	try {
		socket.emit('endGoogleCloudStream', {
			languageCode: ''
		});
		let track = globalStream.getTracks()[0];
		track.stop();
		input.disconnect(processor);
		processor.disconnect(context.destination);
		context.close().then(function () {
			input = null;
			processor = null;
			context = null;
			AudioContext = null;
		});
	} catch (e) {
		console.log(e.message)
	}

}