import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import dadJokes from '@mikemcbride/dad-jokes'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';

const templateURI = 'ui://widget/joke5.html';

const manifest = {
  name: "Demo MCP Server",
  version: "1.0.0",
  mcp: {
    servers: {
      default: {
        transport: "http",
        url: "https://chatgpt-app-demo.ynonp.deno.net/mcp"
      }
    }
  }
};

// Create server instance
const server = new McpServer({
  name: "dadjokes",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
  },
});

server.registerResource(
  'jokes_count',
  'jokes://count',
  {
    title: 'Jokes Count Resource',
  },
  async (uri) => {
    return ({
      contents: [
        {
          uri: uri.href,
          text: `I know ${dadJokes.all.length} jokes`,
        }
      ]
    })
  }
)

server.registerResource(
  'joke-widget',
  templateURI,
  {},
  async () => ({
    contents: [
      {
        uri: templateURI,
        mimeType: "text/html+skybridge",
        text: `
        <style>
          #dad-joke { height: 300px; }
          p { color: green; font-size: 48px }          
        </style>
        <div id="dad-joke">
          <p>Dad joke will appear here</p>
        </div>
        <script>
          window.addEventListener("openai:set_globals", () => {
            const container = document.querySelector('#dad-joke p');
            if (openai.toolOutput && openai.toolOutput.joke) {
              container.textContent = openai.toolOutput.joke;
            } else {
              container.textContent = "joke not found";
            }          
          });          
        </script>
        `,
        _meta: {
          "openai/widgetPrefersBorder": true,          
        }
      }
    ]
  })
)

server.registerTool(
  "tell-me-a-joke",
  {
    inputSchema: {
      id: z.number().min(0).max(dadJokes.all.length).describe('joke id')
    },
    title: 'Joke Teller',
    description: `Tells a joke according to its index. Valid ids 0-${dadJokes.all.length - 1}`,    
    _meta: {
      "openai/outputTemplate": templateURI,
      "openai/toolInvocation/invoking": "Displaying a joke",
      "openai/toolInvocation/invoked": "Displayed a joke"
    },
    annotations: {
      destructiveHint: false,
      openWorldHint: false,
      readOnlyHint: true,
    }
  },
  async ({id}) => {
    return ({
      content: [],
      structuredContent: {joke: dadJokes.all[id] }
    })
  }
)

server.registerTool(
  "tell-me-a-random-joke",  
  {
    title: 'Random Joke Teller',
    description: 'Tells a random joke',    
    _meta: {
      "openai/outputTemplate": templateURI,
      "openai/toolInvocation/invoking": "Displaying a joke",
      "openai/toolInvocation/invoked": "Displayed a joke"
    },    
    annotations: {
      destructiveHint: false,
      openWorldHint: false,
      readOnlyHint: true,
    }    
  },
  async () => {
    return ({
      content: [],
      structuredContent: {joke: dadJokes.random() }
    })
  }
);

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});

app.post('/mcp', async (req: any, res: any) => {
    // Create a new transport for each request to prevent request ID collisions
    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true
    });

    res.on('close', () => {
        transport.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
});

app.get('/manifest.json', (req, res) => {
  res.set({
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*"
  });
  res.send(JSON.stringify(manifest));
});

const port = parseInt(process.env.PORT || '3000');
app.listen(port, () => {
    console.log(`Demo MCP Server running on http://localhost:${port}/mcp`);
}).on('error', error => {
    console.error('Server error:', error);
    process.exit(1);
});

