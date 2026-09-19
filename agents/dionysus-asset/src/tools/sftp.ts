import sftp from "ssh2-sftp-client";

/**
 * Runs `work` on an SFTP connection and closes the connection afterwards,
 * whether the work (or the connection itself) fails or not.
 */
export const withSftp = async <T>(
  connection: sftp.ConnectOptions,
  work: (client: sftp) => Promise<T>,
): Promise<T> => {
  const client = new sftp();

  try {
    await client.connect(connection);
    return await work(client);
  } finally {
    await client.end().catch(() => undefined);
  }
};
