import type { NewsItem } from '../news/types'
import type { XPost } from './types'

export function xPostToNews(post: XPost): NewsItem {
  const handle = `@${post.user.username}`
  return {
    id: `x:${post.id}`,
    sourceId: 'x',
    title: post.text || `Media from ${handle}`,
    url: `https://x.com/${post.user.username}/status/${post.id}`,
    time: post.createdAt,
    score: post.likes + post.reposts,
    info: handle,
    hover: `${post.user.name} · ${post.replies} replies · ${post.reposts} reposts · ${post.likes} likes`,
    xPost: post,
  }
}
