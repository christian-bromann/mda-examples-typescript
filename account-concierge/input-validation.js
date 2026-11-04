function isUserMessage(message) {
  if (typeof message?.getType === "function") return message.getType() === "human";
  return message?.type === "human" || message?.type === "user" || message?.role === "user";
}

function hasInputContent(content) {
  if (typeof content === "string") return content.trim().length > 0;
  if (Array.isArray(content)) return content.some(hasInputContent);
  if (typeof content !== "object" || content === null) return false;
  if (content.type === "file") {
    return [content.data, content.url, content.file_id].some(
      (value) => typeof value === "string" && value.trim().length > 0
    );
  }

  if (content.type === "image_url") return hasInputContent(content.image_url);
  if (content.type === "image") return hasInputContent(content.image);
  if (content.type === "input_audio") return hasInputContent(content.input_audio);

  const inputKeys = ["text", "data", "url", "content", "image_url", "image", "audio", "input_audio", "video", "file_id"];
  return inputKeys.some((key) => hasInputContent(content[key]));
}

function extractText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map(extractText).join(" ");
  if (typeof content !== "object" || content === null) return "";
  return [content.text, content.content].map(extractText).join(" ");
}

export function hasGitHubIssueOrPullRequest(content) {
  return /https?:\/\/github\.com\/[^/\s]+\/[^/\s]+\/(?:pull|issues)\/\d+\b|\b[^/\s#]+\/[^/\s#]+#\d+\b/i.test(extractText(content));
}

export function getAgentInputError(messages, errorMessage, validateContent = hasInputContent) {
  if (!Array.isArray(messages)) return errorMessage;
  const latestUserMessage = [...messages].reverse().find(isUserMessage);
  if (!latestUserMessage || !validateContent(latestUserMessage.content)) return errorMessage;
  return undefined;
}
