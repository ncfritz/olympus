import { DownloadOutlined } from "@ant-design/icons";
import { Button, Flex, Typography } from "antd";
import type { SshCertificateContents } from "@/lib/api/types";
import { saveFile } from "@/lib/download";
import { certificateFileName } from "@/lib/ssh";

/**
 * A certificate as OpenSSH reads it, to copy or save under the name it is
 * installed as, and where that is.
 */
export function SshCertificateFile({
  certificate,
  contents,
}: {
  certificate: string;
  contents: SshCertificateContents;
}) {
  const fileName = certificateFileName(contents);
  return (
    <Flex vertical gap="small">
      <Typography.Paragraph
        code
        copyable={{ text: `${certificate}\n` }}
        ellipsis={{ rows: 3, expandable: true, symbol: "more" }}
      >
        {certificate}
      </Typography.Paragraph>
      <Flex gap="small" align="center" wrap>
        <Button
          icon={<DownloadOutlined />}
          onClick={() => saveFile(fileName, `${certificate}\n`, "text/plain")}
        >
          {fileName}
        </Button>
        <Typography.Text type="secondary">
          {contents.type === "user" ? (
            <>
              Save it beside the key, as{" "}
              <Typography.Text code>~/.ssh/{fileName}</Typography.Text>: ssh
              offers it with the key by itself.
            </>
          ) : (
            <>
              Save it as{" "}
              <Typography.Text code>/etc/ssh/{fileName}</Typography.Text>, named
              by <Typography.Text code>HostCertificate</Typography.Text> in{" "}
              <Typography.Text code>sshd_config</Typography.Text>.
            </>
          )}
        </Typography.Text>
      </Flex>
    </Flex>
  );
}
