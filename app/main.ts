import * as net from "net";

// You can use print statements as follows for debugging, they'll be visible when running tests.
console.log("Logs from your program will appear here!");

// Function to build HTTP response
function buildResponse(statusLine: string, body: string): string {
  return `${statusLine}\r\nContent-Length: ${body.length}\r\nContent-Type: text/plain\r\n\r\n${body}`;
}

// Function to extract header value from incomingData
function getHeader(incomingData: string[], headerName: string): string {
  for (let i = 1; i < incomingData.length; i++) {
    const line = incomingData[i];
    if (line.trim() === "") break;
    const [key, ...valueParts] = line.split(": ");
    if (key === headerName) {
      return valueParts.join(": "); // Join in case value has colon
    }
  }
  return "";
}

// Function to handle GET requests
function handleGet(path: string, incomingData: string[]): string {
  if (path === "/" || path === "/index.html") {
    return buildResponse("HTTP/1.1 200 OK", "Hello from index!");
  } else if (path.startsWith("/echo/")) {
    const echoText = decodeURIComponent(path.slice(6));
    return buildResponse("HTTP/1.1 200 OK", echoText);
  } else if (path.startsWith("/user-agent")) {
    console.log("Incoming Data:", incomingData);
    const userAgent = getHeader(incomingData, "User-Agent");
    console.log("User-Agent:", userAgent);
    return buildResponse("HTTP/1.1 200 OK", userAgent);
  } else {
    return buildResponse("HTTP/1.1 404 Not Found", "404 Not Found");
  }
}

// Uncomment this to pass the first stage
const server = net.createServer((socket) => {
  socket.setEncoding("utf-8");

  socket.on("data", (data: any) => {
    const incomingData = data.split("\r\n");
    const requestLine = incomingData[0];
    const parts = requestLine.split(" ");

    const method = parts[0];
    const path = parts[1];
    const httpVersion = parts[2];

    console.log("Method:", method);
    console.log("Request target:", path);
    console.log("HTTP version:", httpVersion);

    let responseBody = "";

    if (method === "GET") {
      responseBody = handleGet(path, incomingData);
    } else {
      responseBody = buildResponse("HTTP/1.1 404 Not Found", "404 Not Found");
    }

    socket.write(responseBody);
    socket.end();
  });
});

server.listen(4221, "localhost");
