import { instagramCreatePostAction } from "./createPost.action";

// Export all Instagram nodes for registration
export const instagramNodes = {
  [instagramCreatePostAction.type]: instagramCreatePostAction,
};
