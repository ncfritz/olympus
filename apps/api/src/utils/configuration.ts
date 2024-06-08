export default () => ({
  hasura: {
    protocol: process.env.HASURA_PROTOCOL || "http",
    host: process.env.HASURA_HOST || "localhost",
    port: parseInt(process.env.HASURA_PORT || "8080", 10),
    password: process.env.HASURA_PASSWORD || "admin",
  },
});
