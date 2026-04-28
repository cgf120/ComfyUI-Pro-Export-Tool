import { app } from "../../scripts/app.js";

const mediaInputNodeTypes = [
  {
    widget: "image",
    nodeTypes: new Set(["LoadImage"]),
  },
  {
    widget: "audio",
    nodeTypes: new Set(["LoadAudio", "VHS_LoadAudio", "VHS_LoadAudioUpload"]),
  },
  {
    widget: "video",
    nodeTypes: new Set(["LoadVideo", "VHS_LoadVideo", "VHS_LoadVideoFFmpeg"]),
  },
];

const outputNodeTypes = new Set([
  "SaveImage",
  "SaveAudio",
  "SaveImageJPGNoMeta",
  "SaveVideo",
  "VHS_VideoCombine",
]);

function getMediaWidget(targetNodes) {
  for (const { widget, nodeTypes } of mediaInputNodeTypes) {
    if (targetNodes.some((node) => node && nodeTypes.has(node.type))) {
      return widget;
    }
  }
}

function saveToFile(content, filename) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";

  document.body.appendChild(a);
  a.click();

  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}

const ext = {
  name: "ExportChenYuWorkflow",

  commands: [
    {
      id: "save-chenyu-workflow",
      label: "导出晨羽工作流",
      function: async () => {
        try {
          const { output: prompt, workflow } = await app.graphToPrompt();
          const { links, nodes } = workflow;
          const inputs = nodes
            .filter((node) => node.type === "PrimitiveNode" && node.outputs[0].links)
            .map((node) => {
              const targets = node.outputs[0].links.map((link_id) => {
                const link = links.find((link) => link[0] === link_id && link[1] === node.id);
                if (!link) throw node;
                return link[3];
              });
              targets.sort();

              const widget = app.graph._nodes_by_id[node.id].widgets[0];
              const input = {
                id: node.id,
                type: node.outputs[0].type,
                name: node.outputs[0].widget.name,
                value: node.widgets_values[0],
                widget: widget.type,
                label: node.title,
                targets,
              };
              switch (input.widget) {
                case "number":
                  input.options = Object.assign({}, widget.options);
                  if (node.widgets_values.length > 1 && typeof node.widgets_values[1] === "string") {
                    input.options.control_after_generate = node.widgets_values[1];
                  }
                  break;
                case "combo":
                  input.options = widget.options;
                  break;
              }

              const targetNodes = targets.map((node_id) => nodes.find((n) => n.id === node_id));
              const mediaWidget = getMediaWidget(targetNodes);
              if (mediaWidget) {
                if (input.widget !== "combo") throw input;
                input.widget = mediaWidget;
              }

              return input;
            });

          const outputs = [];
          for (const n of nodes) {
            if (outputNodeTypes.has(n.type)) {
              outputs.push({ id: n.id, type: n.type });
            }
          }

          inputs.sort((a, b) => a.id - b.id);
          outputs.sort((a, b) => a.id - b.id);

          if (inputs.length === 0) {
            alert("晨羽工作流导出失败：没有输入！");
          } else if (outputs.length === 0) {
            alert("晨羽工作流导出失败：没有输出！");
          } else {
            saveToFile(
              JSON.stringify({
                version: 1,
                inputs,
                outputs,
                comfyui: {
                  prompt,
                  extra_data: { extra_pnginfo: { workflow } },
                },
              }),
              "chenyu-workflow.json"
            );
          }
        } catch (error) {
          console.error("晨羽工作流导出失败：", error);
          alert("导出晨羽工作流时发生错误！");
        }
      }
    }
  ],
  menuCommands: [
    {
      path: ["晨羽"],
      commands: ["save-chenyu-workflow"],
    },
  ],
};
app.registerExtension(ext);
