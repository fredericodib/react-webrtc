import React, { useRef, useEffect, useState } from "react";
import io from "socket.io-client";

const peerConnectionConfig = {
  iceServers: [
    { urls: "stun:stun.services.mozilla.com" },
    { urls: "stun:stun.l.google.com:19302" },
    {
      urls: "stun:stun.stunprotocol.org",
    },
    {
      urls: "turn:numb.viagenie.ca",
      credential: "muazkh",
      username: "webrtc@live.com",
    },
  ],
};

const Room = (props) => {
  const userVideo = useRef();
  let socketId = useRef();
  let localStream = useRef();
  let connections = [];
  let socket = useRef();

  const [videoObj, _setVideoObj] = useState({});

  const videoObjRef = useRef(videoObj);
  const setVideoObj = (data) => {
    videoObjRef.current = data;
    _setVideoObj(data);
  };

  const [audio, _setAudio] = useState(true);
  const audioRef = useRef(audio);
  const setAudio = (data) => {
    audioRef.current = data;
    _setAudio(data);
  };

  const [video, _setVideo] = useState(true);
  const videoRef = useRef(video);
  const setVideo = (data) => {
    videoRef.current = data;
    _setVideo(data);
  };

  const webRTCOptions = {
    video: {
      frameRate: {
        max: 15,
      },
      width: {
        max: 320,
      },
      height: {
        max: 320,
      },
    },
    audio: {
      sampleSize: 22000,
      echoCancellation: true,
    },
  };

  useEffect(() => {
    const { match } = props;

    navigator.mediaDevices
      .getUserMedia(webRTCOptions)
      .then(getUserMediaSuccess)
      .then(function () {
        socket.current = io("https://live.rimaai.com.br/", {
          transport: ["websocket"],
        }).connect("/");
        socket.current.emit("join", match.params.roomID);
        socket.current.on("signal", gotMessageFromServer);

        socket.current.on("connect", function () {
          socketId.current = socket.current.id;

          socket.current.on("user-left", removeNode);

          socket.current.on("user-joined", function (id, count, clients) {
            clients.forEach(function (socketListId) {
              if (!connections[socketListId]) {
                connections[socketListId] = new RTCPeerConnection(
                  peerConnectionConfig
                );
                //Wait for their ice candidate
                connections[socketListId].onicecandidate = function (event) {
                  if (event.candidate !== null) {
                    socket.current.emit(
                      "signal",
                      socketListId,
                      JSON.stringify({ ice: event.candidate })
                    );
                  }
                };

                //Wait for their video stream
                connections[socketListId].ontrack = function (event) {
                  if (event.streams) {
                    gotRemoteStream(event, socketListId);
                  }
                };

                //Add the local video stream
                // connections[socketListId].addStream(localStream.current);
                localStream.current
                  .getTracks()
                  .forEach((track) =>
                    connections[socketListId].addTrack(
                      track,
                      localStream.current
                    )
                  );

                // peerConnection.addStream(options.stream);
                // options.stream.getTracks().forEach(track => peerConnection.addTrack(track, options.stream))
              }
            });

            //Create an offer to connect with your local description

            if (count >= 2) {
              connections[id].createOffer().then(function (description) {
                connections[id]
                  .setLocalDescription(description)
                  .then(function () {
                    // console.log(connections);
                    socket.current.emit(
                      "signal",
                      id,
                      JSON.stringify({
                        sdp: connections[id].localDescription,
                      })
                    );
                  })
                  .catch((e) => console.log(e));
              });
            }
          });
        });
      });
  }, []);

  const getUserMediaSuccess = (stream) => {
    localStream.current = stream;
    userVideo.current.srcObject = stream;
  };

  const gotRemoteStream = (event, id) => {
    if (!videoObjRef.current[id]) {
      setVideoObj({
        ...videoObjRef.current,
        [id]: event.streams[0],
      });
    }
  };

  const removeNode = (id) => {
    console.log(videoObjRef.current);
    if (videoObjRef.current[id]) {
      const obj = { ...videoObjRef.current };
      delete obj[id];
      setVideoObj({
        ...{},
        ...obj,
      });
    }
  };

  const gotMessageFromServer = (fromId, message) => {
    //Parse the incoming signal
    var signal = JSON.parse(message);

    //Make sure it's not coming from yourself
    // console.log(socketId.current);
    if (fromId !== socketId.current) {
      if (signal.sdp) {
        connections[fromId]
          .setRemoteDescription(new RTCSessionDescription(signal.sdp))
          .then(function () {
            if (signal.sdp.type === "offer") {
              connections[fromId]
                .createAnswer()
                .then(function (description) {
                  connections[fromId]
                    .setLocalDescription(description)
                    .then(function () {
                      socket.current.emit(
                        "signal",
                        fromId,
                        JSON.stringify({
                          sdp: connections[fromId].localDescription,
                        })
                      );
                    })
                    .catch((e) => console.log(e));
                })
                .catch((e) => console.log(e));
            }
          })
          .catch((e) => console.log(e));
      }

      if (signal.ice) {
        connections[fromId]
          .addIceCandidate(new RTCIceCandidate(signal.ice))
          .catch((e) => console.log(e));
      }
    }
  };

  const mute = () => {
    localStream.current.getAudioTracks()[0].enabled = !audio;
    setAudio(!audio);
  };

  const Cam = () => {
    localStream.current.getVideoTracks()[0].enabled = !video;
    setVideo(!video);
  };

  return (
    <div>
      <div className="videoContainer">
        {Object.values(videoObj).map((video) => (
          <video
            autoPlay
            playsInline
            key={video.id}
            ref={(ref) => {
              if (ref) {
                return (ref.srcObject = video);
              }
            }}
          />
        ))}
        <video autoPlay ref={userVideo} muted playsInline />
      </div>
      {audio ? (
        <button onClick={mute} style={{ marginRight: 10 }}>
          Mutar
        </button>
      ) : (
        <button onClick={mute} style={{ marginRight: 10 }}>
          Desmutar
        </button>
      )}
      {video ? (
        <button onClick={Cam}>Desligar Camera</button>
      ) : (
        <button onClick={Cam}>Ligar Camera</button>
      )}
    </div>
  );
};

export default Room;
