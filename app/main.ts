import * as net from "net";
import * as fs from "fs";
import * as process from "process";

// You can use print statements as follows for debugging, they'll be visible when running tests.
console.log("Logs from your program will appear here!");

// Function to build HTTP response
function buildResponse(
  statusLine: string,
  body: string,
  customHeaders: {[key: string]: string} = {}
): string {
  let headers = `${statusLine}\r\nContent-Length: ${body.length}`;
  if (!customHeaders["Content-Type"]) {
    headers += `\r\nContent-Type: text/plain`;
  }
  for (const [key, value] of Object.entries(customHeaders)) {
    headers += `\r\n${key}: ${value}`;
  }
  return `${headers}\r\n\r\n${body}`;
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

// Parse command line arguments for directory
let directory = "/tmp/";
const args = process.argv;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--directory") {
    directory = args[i + 1];
    break;
  }
}

// Function to handle GET requests
function handleGet(path: string, incomingData: string[]): string {
  if (path === "/" || path === "/index.html") {
    return buildResponse("HTTP/1.1 200 OK", "Hello from index!");
  } else if (path.startsWith("/echo/")) {
    const echoText = decodeURIComponent(path.slice(6));

    // Get the compression type from headers
    const acceptEncoding = getHeader(incomingData, "Accept-Encoding");
    console.log("Accept-Encoding:", acceptEncoding);
    if (acceptEncoding !== "gzip") {
      console.log("Unsupported encoding:", acceptEncoding);
      return buildResponse("HTTP/1.1 200 OK", echoText);
    }
    return buildResponse("HTTP/1.1 200 OK", echoText, {
      "Content-Encoding": "gzip",
    });
  } else if (path.startsWith("/user-agent")) {
    console.log("Incoming Data:", incomingData);
    const userAgent = getHeader(incomingData, "User-Agent");
    console.log("User-Agent:", userAgent);
    return buildResponse("HTTP/1.1 200 OK", userAgent);
  } else if (path.startsWith("/files/")) {
    const fileName = path.slice(7);
    const filePath = directory + "/" + fileName;
    try {
      const readFile = fs.readFileSync(filePath, "utf-8");
      return buildResponse("HTTP/1.1 200 OK", readFile, {
        "Content-Type": "application/octet-stream",
      });
    } catch (e) {
      return "HTTP/1.1 404 Not Found\r\n\r\n";
    }
  } else {
    return buildResponse("HTTP/1.1 404 Not Found", "404 Not Found");
  }
}

function handlePost(path: string, incomingData: string[]): string {
  if (path.startsWith("/files/")) {
    const fileName = path.slice(7);
    const filePath = directory + "/" + fileName;
    const incomingDataStr = incomingData.join("\r\n");
    const bodyIndex = incomingDataStr.indexOf("\r\n\r\n");
    const body = incomingDataStr.slice(bodyIndex + 4);
    fs.writeFileSync(filePath, body);
    return buildResponse("HTTP/1.1 201 Created", body, {
      "Content-Type": "application/octet-stream",
    });
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
    } else if (method === "POST") {
      responseBody = handlePost(path, incomingData);
    } else {
      responseBody = buildResponse("HTTP/1.1 404 Not Found", "404 Not Found");
    }

    socket.write(responseBody);
    socket.end();
  });
});

server.listen(4221, "localhost");
