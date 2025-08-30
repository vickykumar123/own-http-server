import * as net from "net";

// You can use print statements as follows for debugging, they'll be visible when running tests.
console.log("Logs from your program will appear here!");

// Uncomment this to pass the first stage
const server = net.createServer((socket) => {
  socket.setEncoding("utf-8");

  socket.on("data", (data: any) => {
    const incomingData = data.split("\r\n");
    const requestLine = incomingData[0]; // Get the request line
    const parts = requestLine.split(" "); // Split by spaces

    // Check if it's a GET request
    const method = parts[0];
    const path = parts[1]; // request target - origin form
    const httpVersion = parts[2];

    console.log("Method:", method);
    console.log("Request target:", path);
    console.log("HTTP version:", httpVersion);

    let responseBody = "";

    if (method === "GET") {
      if (path === "/" || path === "/index.html") {
        const body = "Hello from index!";
        responseBody =
          `HTTP/1.1 200 OK\r\n` +
          `Content-Length: ${body.length}\r\n` +
          `Content-Type: text/plain\r\n` +
          `\r\n` +
          body;
      } else if (path.startsWith("/echo/")) {
        const echoText = decodeURIComponent(path.slice(6)); // Extract text after /echo/
        const body = echoText;
        responseBody =
          `HTTP/1.1 200 OK\r\n` +
          `Content-Length: ${body.length}\r\n` +
          `Content-Type: text/plain\r\n` +
          `\r\n` +
          body;
      } else if (path.startsWith("/user-agent")) {
        const headerLine = incomingData[1]; // Get the first header line
        const userAgent = headerLine.split(": ")[1]; // Extract User-Agent value'
        const body = userAgent;
        responseBody =
          `HTTP/1.1 200 OK\r\n` +
          `Content-Length: ${body.length}\r\n` +
          `Content-Type: text/plain\r\n` +
          `\r\n` +
          body;
      } else {
        const body = "404 Not Found";
        responseBody =
          `HTTP/1.1 404 Not Found\r\n` +
          `Content-Length: ${body.length}\r\n` +
          `Content-Type: text/plain\r\n` +
          `\r\n` +
          body;
      }
    }

    socket.write(responseBody);
    socket.end();
  });
  // socket.write("HTTP/1.1 200 OK\r\n\r\n");
  // socket.on("close", () => {
  //   socket.end();
  // });
});
//
server.listen(4221, "localhost");
