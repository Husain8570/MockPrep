import React, { useEffect, useRef, useState, useCallback } from "react";
import Peer from "simple-peer";
import io from "socket.io-client";
import { useParams, useNavigate } from "react-router-dom";
import { BsTelephoneX } from "react-icons/bs";
import Chat from "../components/Chat";
import { useStore } from "../store/store.js";

const API_URL = import.meta.env.VITE_API_URL;

const socket = io.connect(`${API_URL}`, {
  transports: ["websocket", "polling"],
  withCredentials: true,
});

const VideoCall = () => {
  const { user } = useStore();
  const [role, setRole] = useState(user.role);

  const [peers, setPeers] = useState([]);
  const [myUserId, setMyUserId] = useState(null);
  const [userCount, setUserCount] = useState(0);
  const [isSharing, setIsSharing] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false); // State for chat modal
  const screenVideoRef = useRef(null);
  const screenStreamRef = useRef(null);
  const videoContainer = useRef();

  const navigate = useNavigate();
  const params = useParams();

  const myVideo = useRef();
  const peersRef = useRef({});
  const streamRef = useRef();
  const myVoice = useRef();
  const videoRef = useRef();
  const hiddenVoice = useRef();

  const createPeer = useCallback((userToSignal, callerID, stream) => {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream,
    });

    peer.on("signal", (signal) => {
      if (signal.type === "offer") {
        socket.emit("sending-signal", { userToSignal, callerID, signal });
      }
    });

    peer.on("error", (err) => {
      console.log("Peer error: ", err);
      if (err.toString().includes("Connection failed")) {
        // Handle connection failure (e.g., try to reconnect or remove peer)
        removePeer(userToSignal);
      }
    });

    peer.on("connect", () => {
      console.log("Peer connected:", userToSignal);
    });

    return peer;
  }, []);

  const addPeer = useCallback((incomingSignal, callerID, stream) => {
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream,
    });

    peer.on("signal", (signal) => {
      if (signal.type === "answer") {
        socket.emit("returning-signal", { signal, callerID });
      }
    });

    peer.on("error", (err) => {
      console.log("Peer error: ", err);
      if (err.toString().includes("Connection failed")) {
        // Handle connection failure (e.g., try to reconnect or remove peer)
        removePeer(callerID);
      }
    });

    peer.on("connect", () => {
      console.log("Peer connected:", callerID);
    });

    try {
      peer.signal(incomingSignal);
    } catch (err) {
      console.error("Error signaling peer:", err);
    }

    return peer;
  }, []);

  const removePeer = useCallback((peerId) => {
    console.log("Removing peer:", peerId);
    if (peersRef.current[peerId]) {
      peersRef.current[peerId].destroy();
      delete peersRef.current[peerId];
    }
    setPeers((prevPeers) => prevPeers.filter((p) => p.peerID !== peerId));
  }, []);

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        streamRef.current = stream;

        stream.getTracks().forEach((track) => (track.enabled = false));

        myVideo.current.srcObject = stream;

        socket.emit("join-room", params.id);

        socket.on("your-id", (id) => {
          setMyUserId(id);
          console.log("My user ID:", id);
        });

        socket.on("all-users", (users) => {
          setUserCount(users.length + 1);
          users.forEach((userID) => {
            if (!peersRef.current[userID]) {
              const peer = createPeer(userID, socket.id, stream);
              peersRef.current[userID] = peer;
              setPeers((prevPeers) => [...prevPeers, { peerID: userID, peer }]);
            }
          });
        });

        socket.on("user-joined", (payload) => {
          setUserCount((prevCount) => prevCount + 1);

          if (!peersRef.current[payload.callerID]) {
            const peer = addPeer(payload.signal, payload.callerID, stream);
            peersRef.current[payload.callerID] = peer;
            setPeers((prevPeers) => [
              ...prevPeers,
              { peerID: payload.callerID, peer },
            ]);
          }
        });

        socket.on("receiving-returned-signal", (payload) => {
          const peer = peersRef.current[payload.id];
          if (peer && !peer.destroyed) {
            try {
              peer.signal(payload.signal);
            } catch (err) {
              console.log("Error signaling peer:", err);
              removePeer(payload.id);
            }
          }
        });

        socket.on("user-disconnected", (userId) => {
          setUserCount((prevCount) => prevCount - 1);
          removePeer(userId);
        });
      });

    return () => {
      socket.emit("disconnect-from-room", params.id);
      socket.off("your-id");
      socket.off("all-users");
      socket.off("user-joined");
      socket.off("receiving-returned-signal");
      socket.off("user-disconnected");
      streamRef.current?.getTracks().forEach((track) => track.stop());
      Object.values(peersRef.current).forEach((peer) => peer.destroy());
      peersRef.current = {};
      setPeers([]);
    };
  }, [params.id, addPeer, removePeer, createPeer]);

  const handleDisconnect = () => {
    socket.emit("disconnect-from-room", params.id);
    navigate("/createroom");
  };

  const handleVoice = () => {
    const audioTrack = streamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled; // Toggle audio track
      myVoice.current.firstChild.src = audioTrack.enabled
        ? "/mic.png"
        : "/no-noise.png";
    }

    if (audioTrack.enabled == false) {
      console.log("Audio is disabled");
      hiddenVoice.current.style.display = "block";
    } else {
      console.log("Audio is enabled");
      hiddenVoice.current.style.display = "none";
    }
  };

  const handleVideo = () => {
    const videoTrack = streamRef.current.getVideoTracks()[0];

    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled; // Toggle video track
      videoRef.current.firstChild.src = videoTrack.enabled
        ? "/video-camera.png"
        : "/no-video.png";
    }
  };

  const startScreenShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
      screenVideoRef.current.srcObject = screenStream;
      screenStreamRef.current = screenStream;
      setIsSharing(true);

      videoContainer.current.classList.remove("hidden");

      // Stop sharing when the user closes the screen share dialog
      screenStream.getVideoTracks()[0].onended = () => stopScreenShare();
    } catch (error) {
      console.error("Error sharing screen:", error);
    }
  };

  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      videoContainer.current.classList.add("hidden");
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      setIsSharing(false);
    }
  };

  const toggleChatModal = () => {
    setIsChatOpen(!isChatOpen);
  };

  return (
    <>
      <div className="p-8">
        <div ref={videoContainer} className="p-8 hidden">
          <div className="flex  justify-center items-center">
            <video
              ref={screenVideoRef}
              autoPlay
              playsInline
              className="max-w-lg h-auto border-4 border-green-400 rounded-lg w-[1/2]"
            />
          </div>
        </div>

        <div className="video-container flex justify-start items-center flex-wrap gap-2 ">
          <div className="relative flex flex-col flex-wrap gap-2">
            <img
              ref={hiddenVoice}
              className="absolute right-0 top-0 bg-gray-500 bg-opacity-60 text-white px-2 py-1 rounded w-[50px]"
              src="/no-noise.png"
              alt=""
            />
            <video
              autoPlay
              playsInline
              muted
              ref={myVideo}
              width={450}
              className="rounded-lg h-auto"
            ></video>
            <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded">
              You ({role})
            </div>
            {peers.map((peer, index) => (
              <Video key={index} peer={peer.peer} />
            ))}
          </div>

          <Chat />
        </div>

        <div className="buttons flex gap-2 justify-center mt-2">
          <button
            ref={myVoice}
            onClick={handleVoice}
            className=" transition text-white rounded-full p-3"
          >
            <img src="/no-noise.png" alt="mic" className="w-7" />
          </button>
          <button
            ref={videoRef}
            onClick={handleVideo}
            className=" transition text-white rounded-full p-3"
          >
            <img src="/no-video.png" alt="video" className="w-7" />
          </button>

          {!isSharing ? (
            <button
              onClick={startScreenShare}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
            >
              Start Screen Share
            </button>
          ) : (
            <button
              onClick={stopScreenShare}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
            >
              Stop Screen Share
            </button>
          )}
          <button
            onClick={handleDisconnect}
            className="bg-[#dc263e] hover:bg-red-500 w-28 transition text-white rounded-full p-3 flex justify-center items-center"
          >
            <BsTelephoneX className="text-2xl" />
          </button>
        </div>
      </div>
    </>
  );
};

const Video = ({ peer }) => {
  const ref = useRef();
  const hiddenPeerVoice = useRef();
  
  useEffect(() => {
    if (peer) {
      peer.on("stream", (stream) => {
        if (ref.current) {
          ref.current.srcObject = stream;
        }
        // Get the audio tracks and monitor them
        const audioTrack = stream.getAudioTracks()[0];
  
        // Set initial state (check if muted on initial load)
        if(audioTrack.enabled == false){
            hiddenPeerVoice.current.style.display = 'block';
        }
        else{
            hiddenPeerVoice.current.style.display = 'none';
        }
      });
    }
  }, [peer]);

  return (
    <div className="relative">
      <video
        autoPlay
        playsInline
        ref={ref}
        width={450}
        className="rounded-lg h-auto"
      />
       <img ref={hiddenPeerVoice} className='absolute top-2 left-2 bg-gray-500 bg-opacity-60 text-white px-2 py-1 rounded w-[50px]' src="./no-noise.png" alt="" />
      <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded">
        Peer
      </div>
    </div>
  );
};

export default VideoCall;
