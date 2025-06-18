import * as React from "react";
import ReactHtmlParser from "react-html-parser";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vs } from "react-syntax-highlighter/dist/esm/styles/prism";

export interface NoteHtmlDisplayProps {
  value: string;
}

const NoteHtmlDisplay: React.FunctionComponent<NoteHtmlDisplayProps> = ({
  value,
}: NoteHtmlDisplayProps) => {
  return (
    <>
      {ReactHtmlParser(value, {
        transform: (node, index) => {
          let language = undefined;

          if (node.parent?.attribs!["class"]) {
            const classes = node.parent?.attribs["class"].split("\\s+");

            for (const cls of classes) {
              console.log(cls);
              if (cls.startsWith("language-")) {
                language = cls.substring("language-".length);
                break;
              }
            }
          }

          if (node.type === "tag" && node.name === "code") {
            return (
              <SyntaxHighlighter
                key={index}
                language={language}
                customStyle={{
                  fontSize: "12px",
                  borderRadius: 6,
                }}
                showLineNumbers={true}
                style={vs}
              >
                {node.children![0].data}
              </SyntaxHighlighter>
            );
          }
          return undefined;
        },
      })}
    </>
  );
};
export default NoteHtmlDisplay;
