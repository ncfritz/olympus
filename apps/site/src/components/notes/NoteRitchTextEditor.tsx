import { Editor } from "@tinymce/tinymce-react";
import { Space, Spin } from "antd";
import React, { useRef, useState } from "react";

export interface NoteRichTextEditorProps {
  onChange: () => void;
  value: string;
  height: number;
}
const NoteRichTextEditor: React.FunctionComponent<NoteRichTextEditorProps> = ({
  onChange,
  value,
  height=300,
}: NoteRichTextEditorProps) => {
  const editorRef = useRef<Editor | null>(null);

  const [editorLoaded, setEditorLoaded] = useState(false);

  const loader = editorLoaded ? undefined : (
    <Space
      style={{
        width: "100%",
        alignContent: "center",
        alignItems: "center",
        height: height,
      }}
    >
      <Spin size={"default"} />
    </Space>
  );

  return (
    <Space
      style={{
        width: "100%",
      }}
      direction={"vertical"}
    >
      {loader}
      <Space
        style={{ display: editorLoaded ? "inherit" : "none", width: "100%" }}
      >
        <Editor
          ref={editorRef}
          tinymceScriptSrc={"/assets/libs/tinymce/tinymce.min.js"}
          onInit={(event, editor) => {
            setEditorLoaded(true);
          }}
          onEditorChange={onChange}
          value={value}
          init={{
            branding: false,
            height: height,
            menubar: "edit view insert format tools table",
            plugins: [
              "accordion",
              "advlist",
              "advcode",
              "advtable",
              "anchor",
              "autolink",
              "autosave",
              "charmap",
              "checklist",
              "codesample",
              "directionality",
              "editimage",
              "emoticons",
              "image",
              "importcss",
              "insertdatetime",
              "link",
              "lists",
              "media",
              "nonbreaking",
              "pagebreak",
              "preview",
              "quickbars",
              "searchreplace",
              "table",
              "save",
              "visualblocks",
              "visualchars",
              "wordcount",
            ],
            toolbar: [
              {
                name: "history",
                items: ["undo", "redo", "checklist"],
              },
              {
                name: "styles",
                items: ["blocks", "fontfamily", "fontsize"],
              },
              {
                name: "formsatting",
                items: [
                  "bold",
                  "italic",
                  "underline",
                  "strikethrough",
                  "forecolor",
                  "backcolor",
                ],
              },
              {
                name: "alignment",
                items: ["align", "outdent", "indent", "numlist", "bullist"],
              },
              {
                name: "links",
                items: ["link", "image"],
              },
              {
                name: "table",
                items: ["table"],
              },
            ],
            content_style:
              "body { font-family:Helvetica,Arial,sans-serif; font-size:14px }",
            advcode_inline: true,
            codesample_languages: [
              { text: "JSON", value: "json" },
              { text: "HTML/XML", value: "markup" },
              { text: "CSS", value: "css" },
              { text: "JavaScript", value: "javascript" },
              { text: "SQL", value: "sql" },
              { text: "PHP", value: "php" },
              { text: "Ruby", value: "ruby" },
              { text: "Python", value: "python" },
              { text: "Java", value: "java" },
              { text: "C", value: "c" },
              { text: "C#", value: "csharp" },
              { text: "C++", value: "cpp" },
            ],
          }}
        />
      </Space>
    </Space>
  );
};
export default NoteRichTextEditor;
