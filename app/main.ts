import * as net from "net";
import * as fs from "fs";
import * as process from "process";
import * as zlib from "zlib";
import * as tls from "tls";

// You can use print statements as follows for debugging, they'll be visible when running tests.
console.log("Logs from your program will appear here!");

// Function to build HTTP response
function buildResponse(
  statusLine: string,
  body: string | Buffer,
  customHeaders: {[key: string]: string} = {}
): {headers: string; body: string | Buffer} {
  const bodyLength = Buffer.isBuffer(body) ? body.length : body.length;
  let headers = `${statusLine}\r\nContent-Length: ${bodyLength}\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Credentials: true`;
  if (!customHeaders["Content-Type"]) {
    headers += `\r\nContent-Type: text/plain`;
  }
  for (const [key, value] of Object.entries(customHeaders)) {
    headers += `\r\n${key}: ${value}`;
  }
  return {headers, body};
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
function handleGet(
  pathname: string,
  searchParams: URLSearchParams,
  incomingData: string[]
): {headers: string; body: string | Buffer} {
  console.log("Pathname:", pathname);
  console.log("Search Params:", searchParams.toString());
  if (pathname === "/" || pathname === "/index.html") {
    return buildResponse("HTTP/1.1 200 OK", "Hello from index!");
  } else if (pathname.startsWith("/echo/")) {
    const echoText = decodeURIComponent(pathname.slice(6));

    const acceptEncoding = getHeader(incomingData, "Accept-Encoding");
    console.log("Accept-Encoding:", acceptEncoding);
    if (acceptEncoding && acceptEncoding.includes("gzip")) {
      const compressed = zlib.gzipSync(Buffer.from(echoText));
      return {
        headers: `HTTP/1.1 200 OK\r\nContent-Encoding: gzip\r\nContent-Length: ${compressed.length}\r\nContent-Type: text/plain`,
        body: compressed,
      };
    }
    return buildResponse("HTTP/1.1 200 OK", echoText);
  } else if (pathname.startsWith("/user-agent")) {
    console.log("Incoming Data:", incomingData);
    const userAgent = getHeader(incomingData, "User-Agent");
    console.log("User-Agent:", userAgent);
    return buildResponse("HTTP/1.1 200 OK", userAgent);
  } else if (pathname.startsWith("/files/")) {
    const fileName = pathname.slice(7);
    const filePath = directory + "/" + fileName;
    try {
      const readFile = fs.readFileSync(filePath, "utf-8");
      return buildResponse("HTTP/1.1 200 OK", readFile, {
        "Content-Type": "application/octet-stream",
      });
    } catch (e) {
      return {headers: "HTTP/1.1 404 Not Found", body: ""};
    }
  } else if (pathname === "/search") {
    const q = searchParams.get("q");
    const limit = searchParams.get("limit");
    const p = searchParams.get("page");
    return buildResponse(
      "HTTP/1.1 200 OK",
      JSON.stringify({
        query: q,
        limit: limit ? parseInt(limit) : 10,
        page: p ? parseInt(p) : 1,
        Results: [`Item 1 for ${q}`, `Item 2 for ${q}`],
      }),
      {
        "Content-Type": "application/json",
      }
    );
  } else {
    return buildResponse("HTTP/1.1 404 Not Found", "404 Not Found");
  }
}

function handlePost(
  pathname: string,
  searchParams: URLSearchParams,
  incomingData: string[]
): {headers: string; body: string | Buffer} {
  if (pathname.startsWith("/files/")) {
    const fileName = pathname.slice(7);
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
const options = {
  key: fs.readFileSync("key.pem"),
  cert: fs.readFileSync("cert.pem"),
};
const server = tls.createServer(options, (socket) => {
  // socket.setEncoding("utf-8");

  socket.on("data", (data: Buffer) => {
    const incomingData = data.toString().split("\r\n");
    const requestLine = incomingData[0];
    const parts = requestLine.split(" ");

    const method = parts[0];
    const path = parts[1];
    const httpVersion = parts[2];

    console.log("Method:", method);
    console.log("Request target:", path);
    console.log("HTTP version:", httpVersion);

    let result: {headers: string; body: string | Buffer};

    // Parse URL and query parameters
    const host = getHeader(incomingData, "Host");
    const url = new URL(path, `https://${host || "localhost:443"}`);
    const pathname = url.pathname;
    const searchParams = url.searchParams;

    if (method === "OPTIONS") {
      // Handle CORS preflight requests
      result = {
        headers:
          "HTTP/1.1 200 OK\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type, Authorization, User-Agent, Accept-Encoding\r\nAccess-Control-Max-Age: 86400\r\n",
        body: "",
      };
    } else if (method === "GET") {
      result = handleGet(pathname, searchParams, incomingData);
    } else if (method === "POST") {
      result = handlePost(pathname, searchParams, incomingData);
    } else {
      result = buildResponse("HTTP/1.1 404 Not Found", "404 Not Found");
    }

    // Echo Connection header if present
    const connectionHeader = getHeader(incomingData, "Connection");
    if (connectionHeader) {
      result.headers += `\r\nConnection: ${connectionHeader}`;
    }

    socket.write(result.headers + "\r\n\r\n");
    socket.write(result.body);

    // Close connection only if client requests it
    if (connectionHeader === "close") {
      socket.end();
    }
  });
});

server.listen(443, "localhost");
