import { AudioFilled, AudioOutlined, CloseOutlined } from "@ant-design/icons";
import { Button, Flex, FloatButton, Space, Typography } from "antd";
import React, { useRef, useState } from "react";
import { LiveAudioVisualizer } from "react-audio-visualize";
import { useForm } from "react-hook-form";
import NotesEditorForm, {
  NEW_NOTE,
  type NotesFormInput,
} from "./NotesEditorForm";

const TranscriptionButton: React.FunctionComponent = () => {
  const websocketRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);

  const { handleSubmit, control, reset, setValue } = useForm<NotesFormInput>({
    defaultValues: NEW_NOTE,
    mode: "onChange",
    reValidateMode: "onChange",
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [noteViewOpen, setNoteViewOpen] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder>();

  const startListening = async () => {
    setTranscript("");

    const websocket = new WebSocket(
      "ws://localhost:2345/asr?language=en&mode=diff",
    );
    websocket.onopen = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      const recorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });
      setMediaRecorder(recorder);

      recorder.ondataavailable = async (event) => {
        if (event.data.size > 0 && websocket.readyState === WebSocket.OPEN) {
          const arrayBuffer = await event.data.arrayBuffer();
          websocket.send(arrayBuffer);
        }
      };

      recorder.start(500);
      recorderRef.current = recorder;

      setIsListening(true);
    };

    websocket.onmessage = (event) => {
      const message: any = JSON.parse(event.data);
      console.log(message);

      switch (message.type) {
        case "config":
          break;
        case "ready_to_stop":
          break;
        case "snapshot":
          setTranscript(message.lines.map((line: any) => line.text).join(" "));
          break;
        case "diff":
          break;
        default:
          if (message.status === "no_audio_detected") {
            break;
          }

          setTranscript(message.lines.map((line: any) => line.text).join(" "));
          break;
      }

      if (message.error) {
        console.error(message.message);
      }
    };

    websocket.onerror = () => {
      setIsListening(false);
    };
    websocket.onclose = () => {
      setIsListening(false);
    };

    websocketRef.current = websocket;
  };

  const stopListening = () => {
    recorderRef.current?.stop();
    recorderRef.current?.stream.getTracks().forEach((track) => track.stop());

    if (websocketRef.current?.readyState === WebSocket.OPEN) {
      websocketRef.current.send(new ArrayBuffer(0));
    }

    setIsListening(false);
  };

  const toggleListening = async () => {
    if (isListening) {
      stopListening();
      setValue("value", transcript);
      setNoteViewOpen(true);
    } else {
      setNoteViewOpen(false);
      await startListening();
    }
  };

  return (
    <div>
      <FloatButton
        shape={"circle"}
        icon={dialogOpen ? <CloseOutlined /> : <AudioOutlined />}
        type={dialogOpen ? "default" : "primary"}
        onClick={async () => {
          if (!dialogOpen) {
            setDialogOpen(true);
          } else {
            stopListening();
            setNoteViewOpen(false);
            setTranscript("");
            setDialogOpen(false);
          }
        }}
        style={{ boxShadow: dialogOpen ? "none" : "inherit" }}
      />
      <Flex
        vertical={true}
        style={{
          visibility: dialogOpen ? "visible" : "hidden",
          backgroundColor: "#f9f9f9",
          position: "fixed",
          width: noteViewOpen ? 950 : 650,
          height: noteViewOpen ? 522 : 400,
          right: 16,
          bottom: 38,
          border: "1px solid #efefef",
          borderRadius: 8,
          borderBottomRightRadius: 28,
          boxShadow: "0 0 10px rgba(0, 0, 0, 0.1)",
          transition: "width 0.5s ease-in-out, height 0.5s ease-in-out",
        }}
      >
        {noteViewOpen ? (
          <NotesEditorForm
            className={"rounded-header in-container"}
            onClose={() => {
              setTranscript("");
              setNoteViewOpen(false);
              setDialogOpen(false);
              setIsListening(false);
              reset();
            }}
            formControl={{
              control: control,
              reset: reset,
              handleSubmit: handleSubmit,
            }}
            style={{
              backgroundColor: "#f9f9f9",
              borderRadius: "inherit",
            }}
            showSummary={false}
            showTitle={false}
            buttonsPosition={"left"}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Space orientation={"horizontal"} size={8} style={{ padding: 16 }}>
              <Typography.Text strong={true}>Transcription</Typography.Text>
            </Space>
            <div
              style={{
                display: "flex",
                flexGrow: 1,
                padding: 16,
                color: "#d9d9d9",
                marginBottom: 8,
                borderTop: "1px solid #d9d9d9",
                borderBottom: "1px solid #d9d9d9",
                backgroundColor: "#ffffff",
                fontFamily: "monospace",
                fontSize: "12px",
              }}
            >
              {transcript}
            </div>
            <Space
              direction={"horizontal"}
              style={{
                width: "100%",
                padding: 16,
                paddingTop: 8,
                paddingBottom: 8,
              }}
            >
              <Button
                icon={<AudioFilled />}
                size={"large"}
                type={"primary"}
                danger={true}
                onClick={toggleListening}
                style={{ borderRadius: 32 }}
              />
              {mediaRecorder && (
                <LiveAudioVisualizer
                  mediaRecorder={mediaRecorder}
                  width={350}
                  height={40}
                  backgroundColor={"#f9f9f9"}
                  barColor={"#666666"}
                />
              )}
            </Space>
          </div>
        )}
      </Flex>
    </div>
  );
};
export default TranscriptionButton;
