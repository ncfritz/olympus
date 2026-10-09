import * as React from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { coy } from "react-syntax-highlighter/dist/esm/styles/prism";

export interface CodeBlockProps {
  value: string;
  language: string;
}

const CodeBlock: React.FunctionComponent<CodeBlockProps> = ({
  value,
  language,
}: CodeBlockProps) => {
  return (
    <SyntaxHighlighter language={language} style={coy}>
      {value}
    </SyntaxHighlighter>
  );
};

export default CodeBlock;
