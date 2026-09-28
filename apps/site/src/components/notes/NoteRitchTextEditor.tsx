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
  height = 300,
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
        justifyContent: "center",
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
      orientation={"vertical"}
    >
      {loader}
      <Space
        style={{ display: editorLoaded ? "inherit" : "none", width: "100%" }}
      >
        <Editor
          ref={editorRef}
          tinymceScriptSrc="/assets/libs/tinymce/tinymce.js"
          onInit={(event, editor) => {
            setEditorLoaded(true);
          }}
          onEditorChange={onChange}
          value={value}
          licenseKey={
            "T8LK:eyJhcGlfa2V5IjoiVzR4M2ZmS3IxdlZLUXk0cjZnZVMwMmN4U0xoWTRkNkhySG1CY2d1dHFBRlYyQjRLIiwiYWxnIjoiRVMyNTYiLCJ4NWMiOlsiTUlJQmhUQ0NBU3VnQXdJQkFnSUlQY2ZMWi9lMEw4b3dDZ1lJS29aSXpqMEVBd0l3T1RFVU1CSUdBMVVFQ2hNTGJtTm1jbWwwZWk1dVpYUXhJVEFmQmdOVkJBTVRHRlJwYm5sTlEwVWdPQ0JzYVdObGJuTmxJR3RsZVNCRFFUQWdGdzB5TmpBM01qRXdNREF3TURCYUdBOHlNRGMyTURjeU1ESXpOVGsxT1Zvd0VqRVFNQTRHQTFVRUF4TUhWRGhNUzFNdFVEQlpNQk1HQnlxR1NNNDlBZ0VHQ0NxR1NNNDlBd0VIQTBJQUJETlFKQnNMcUdmN3ZXL2MzWTVLbmhUTkVXVk5ERHo4SnhMcGNPSXJxcUo4bE42NUxHVktscGdieHJqNkw0dkRRSDFjOXgrRkhDWGpyM3N4KzN4cEJLR2pRakJBTUIwR0ExVWREZ1FXQkJSeXBpU21RclVvU0NtamNjUlpybS9ERGdxS05UQWZCZ05WSFNNRUdEQVdnQlR0YU9lMS9ibDQ1TElpUnFucmtLQktFdTlBR3pBS0JnZ3Foa2pPUFFRREFnTklBREJGQWlBYWV0RWxJMEJPeHA3ajZ0eEdBNnVNN0ZvS0d5ZEc2a0VVNEhIZ2laUCs4UUloQU9SckdiSEZFOVRyL2JpYjBiM2R0NC9XakVScmhLU0hraGE3MnVudHBoeVQiXX0.CiQ5NjU1NWJmOS1kNTIxLTQ5NzgtODlmYy0wMmQzYTgzOTc0ZGKaAgDCAgoKBgiAroOsDBIAsAQI0gUBAQ.NYjMMnQ14sVamEQ0y6tX8i1GurA1ucbzpOT-MjFq4mw7B-Uw1H9bciQwXk-WCPzYtRWBlzG9GuG0f5VHKTVvHw"
          }
          init={{
            branding: false,
            height: height,
            menubar: "edit view insert format tools table",
            contextmenu: false,
            browser_spellcheck: true,
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
              "licensekeymanager",
              "link",
              "lists",
              "math",
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
            quickbars_insert_toolbar: false,
            codesample_languages: [
              { text: "Shell", value: "shell" },
              { text: "JSON", value: "json" },
              { text: "YAML", value: "yaml" },
              { text: "HTML/XML", value: "markup" },
              { text: "CSS", value: "css" },
              { text: "JavaScript", value: "javascript" },
              { text: "TypeScript", value: "typescript" },
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
