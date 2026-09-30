// SPDX-License-Identifier: AGPL-3.0-only
// Ported from nitter/src/consts.nim

// These are standard web constants extracted from active browser sessions

// --- GraphQL Endpoints ---

export const graphUser = "ck5KkZ8t5cOmoLssopN99Q/UserByScreenName";
export const graphUserV2 = "WEoGnYB0EG1yGwamDCF6zg/UserResultByScreenNameQuery";
export const graphUserById = "VN33vKXrPT7p35DgNR27aw/UserResultByIdQuery";
export const graphUserTweetsV2 = "6QdSuZ5feXxOadEdXa4XZg/UserWithProfileTweetsQueryV2";
export const graphUserTweetsAndRepliesV2 =
  "BDX77Xzqypdt11-mDfgdpQ/UserWithProfileTweetsAndRepliesQueryV2";
export const graphUserTweets = "oRJs8SLCRNRbQzuZG93_oA/UserTweets";
export const graphUserTweetsAndReplies = "kkaJ0Mf34PZVarrxzLihjg/UserTweetsAndReplies";
export const graphUserMedia = "36oKqyQ7E_9CmtONGjJRsA/UserMedia";
export const graphUserMediaV2 = "bp0e_WdXqgNBIwlLukzyYA/MediaTimelineV2";
export const graphTweet = "b4pV7sWOe97RncwHcGESUA/ConversationTimeline";
export const graphTweetDetail = "iFEr5AcP121Og4wx9Yqo3w/TweetDetail";
export const graphTweetResult = "qxWQxcMLiTPcavz9Qy5hwQ/TweetResultByRestId";
export const graphTweetEditHistory = "upS9teTSG45aljmP9oTuXA/TweetEditHistory";
export const graphSearchTimeline = "yIphfmxUO-hddQHKIOk9tA/SearchTimeline";
export const graphModernSearchTimeline = "yIphfmxUO-hddQHKIOk9tA/SearchTimeline";
export const graphListById = "cIUpT1UjuGgl_oWiY7Snhg/ListByRestId";
export const graphListBySlug = "K6wihoTiTrzNzSF8y1aeKQ/ListBySlug";
export const graphListMembers = "fuVHh5-gFn8zDBBxb8wOMA/ListMembers";
export const graphListTweets = "VQf8_XQynI3WzH6xopOMMQ/ListTimeline";
export const graphPinnedTimelines = "U3t27PzyhYJkkyOOddrTEg/PinnedTimelines";
export const graphCommunityTweets = "HqlI54tLj-mLXuNIop3mGw/CommunityTweetsTimeline";
export const graphFollowing = "OLm4oHZBfqWx8jbcEhWoFw/Following";
export const graphFollowers = "9jsVJ9l2uXUIKslHvJqIhw/Followers";
export const graphHomeTimeline = "SFxmNKWfN9ySJcXG_tjX8g/HomeTimeline";
export const graphHomeLatestTimeline = "SFxmNKWfN9ySJcXG_tjX8g/HomeLatestTimeline";

export const graphFavoriteTweet = "lI07N6Otwv1PhnEgXILM7A/FavoriteTweet";
export const queryIdFavoriteTweet = "lI07N6Otwv1PhnEgXILM7A";
// ROTATION-PRONE (same caveat as DeleteRetweet): web UnfavoriteTweet persisted-query
// id. If unlike 404s, client.ts self-heals via query-resolver and retries once.
export const graphUnfavoriteTweet = "ZYKSe2VSCRCa2Ywn-2s32g/UnfavoriteTweet";
export const queryIdUnfavoriteTweet = "ZYKSe2VSCRCa2Ywn-2s32g";
export const graphCreateRetweet = "mbRO74GrOvSfRcJnlMapnQ/CreateRetweet";
export const queryIdCreateRetweet = "mbRO74GrOvSfRcJnlMapnQ";
// ROTATION-PRONE (same caveat as CreateTweet/DeleteTweet below): this is X's
// *web* DeleteRetweet persisted-query id and X rotates it without notice. If an
// un-retweet returns `404 (deprecated query id)`, this id has rotated — the
// client's 404 self-heal (trySelfHealQueryId → query-resolver.ts) resolves the
// live id from X's web bundle and retries once, so a stale value recovers
// transparently in-session; refreshing the 22-char string just avoids that
// one-time heal round-trip. `iQtK4dl5hBmXewYZuEOKVw` is the long-standing
// web DeleteRetweet id.
export const graphDeleteRetweet = "iQtK4dl5hBmXewYZuEOKVw/DeleteRetweet";
export const queryIdDeleteRetweet = "iQtK4dl5hBmXewYZuEOKVw";

// --- Compose (CreateTweet / DeleteTweet) ---
//
// ROTATION-PRONE: these are X *web* client persisted-query ids, and X rotates
// them without notice. If a live post/delete returns `404 (deprecated query id)`
// from client.ts, the id below has rotated and needs refreshing — a live request
// is the ONLY thing that can confirm the current value. The client's self-heal
// (query-resolver.ts) resolves the live id from X's web bundle and retries once
// on any 404, so a stale value here recovers transparently in-session; refreshing
// the string just avoids that one-time heal round-trip.
//
// To update after a rotation: change ONLY the 22-char id in each string below
// (and the matching queryId const). DeleteTweet's id (`VaenaVgh5q5ih7kvyVjgtg`)
// has been stable for years; CreateTweet's rotates more often.
export const graphCreateTweet = "xT36w0XM3A8jDynpkram2A/CreateTweet";
export const queryIdCreateTweet = "xT36w0XM3A8jDynpkram2A";
export const graphDeleteTweet = "VaenaVgh5q5ih7kvyVjgtg/DeleteTweet";
export const queryIdDeleteTweet = "VaenaVgh5q5ih7kvyVjgtg";

// Pin / unpin a post to the profile (official PinTweet/UnpinTweet). The ids
// below are best-known web persisted-query ids; if X rotated them the client
// self-heals on the first 404 (resolveQueryId is operation-name based).
export const graphPinTweet = "swpWJLBA7L5A0i3jQ0hO5g/PinTweet";
export const queryIdPinTweet = "swpWJLBA7L5A0i3jQ0hO5g";
export const graphUnpinTweet = "sIEkV4bEJ3VxyWjJ8FKm1Q/UnpinTweet";
export const queryIdUnpinTweet = "sIEkV4bEJ3VxyWjJ8FKm1Q";
// Edit an existing post (official "UpdateTweet", a.k.a. edit for subscribers).
export const graphUpdateTweet = "6miFJTu0V-8VjJH7d-x05c/UpdateTweet";
export const queryIdUpdateTweet = "6miFJTu0V-8VjJH7d-x05c";
// Poll vote (web PollVoteTweet). Doc-id deliberately a placeholder — the
// client self-heals it from x.com assets on the first 404.
export const graphPollVote = "0/PollVoteTweet";

// Bookmarks
export const graphBookmarks = "2neUNDqrrFzbLui8yallcQ/Bookmarks";
export const graphCreateBookmark = "aoDbu3RHznuiSkQ9aNM67Q/CreateBookmark";
export const queryIdCreateBookmark = "aoDbu3RHznuiSkQ9aNM67Q";
export const graphDeleteBookmark = "Wlmlj2-xzyS1GN3a6cj-mQ/DeleteBookmark";
export const queryIdDeleteBookmark = "Wlmlj2-xzyS1GN3a6cj-mQ";

// Likes Timeline
export const graphLikes = "lIDpu_NWL7_VhimGGt0o6A/Likes";

// Notifications
export const graphNotifications = "GquVPn-SKYxKLgLsRPpJ6g/NotificationsTimeline";

// --- 1.1 REST endpoints (DMs, trends, media upload) ---
//
// These are NOT GraphQL persisted queries, so they carry no rotation-prone
// query id and the client's 404 self-heal does not apply — a 404 here means the
// v1.1 endpoint itself moved/was retired and needs a live re-check (see the
// per-function confidence notes in api.ts). The DM + trends endpoints resolve
// against `api.x.com` via client.ts::toUrl (any "1.1/..." endpoint does); media
// upload lives on a DIFFERENT host (`upload.twitter.com`) that toUrl can't build,
// so uploadMedia issues its own request (see api.ts).
export const restDmInbox = "1.1/dm/inbox_initial_state.json";
export const restDmConversation = (id: string) => `1.1/dm/conversation/${id}.json`;
export const restDmNew = "1.1/dm/new2.json";
export const restTrendsPlace = "1.1/trends/place.json";

/** Full URL of X's chunked media-upload endpoint (separate host — see uploadMedia). */
export const mediaUploadUrl = "https://upload.twitter.com/1.1/media/upload.json";

// --- GraphQL Features ---

export const gqlFeatures = JSON.stringify({
  rweb_video_screen_enabled: false,
  payments_enabled: false,
  rweb_xchat_enabled: false,
  profile_label_improvements_pcf_label_in_post_enabled: true,
  rweb_tipjar_consumption_enabled: true,
  verified_phone_label_enabled: false,
  creator_subscriptions_tweet_preview_api_enabled: true,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  premium_content_api_read_enabled: false,
  communities_web_enable_tweet_community_results_fetch: true,
  c9s_tweet_anatomy_moderator_badge_enabled: true,
  responsive_web_grok_analyze_button_fetch_trends_enabled: false,
  responsive_web_grok_analyze_post_followups_enabled: true,
  responsive_web_jetfuel_frame: true,
  responsive_web_grok_share_attachment_enabled: true,
  articles_preview_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  view_counts_everywhere_api_enabled: true,
  longform_notetweets_consumption_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  tweet_awards_web_tipping_enabled: false,
  responsive_web_grok_show_grok_translated_post: false,
  responsive_web_grok_analysis_button_from_backend: true,
  creator_subscriptions_quote_tweet_preview_enabled: false,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: true,
  responsive_web_grok_image_annotation_enabled: true,
  responsive_web_grok_imagine_annotation_enabled: true,
  responsive_web_enhance_cards_enabled: false,
  responsive_web_profile_redirect_enabled: false,
  responsive_web_grok_annotations_enabled: false,
  content_disclosure_indicator_enabled: false,
  content_disclosure_ai_generated_indicator_enabled: false,
  responsive_web_grok_community_note_auto_translation_is_enabled: false,
  post_ctas_fetch_enabled: false,
});

// CreateTweet requires a `features` object inside the POST body (the simple
// like/retweet/bookmark mutations don't). It uses roughly the same
// tweet-consumption feature set as the read paths, so we derive it from
// gqlFeatures. Parsed to an object because the mutation body embeds `features`
// as real JSON (not a nested JSON string). DeleteTweet needs no features.
export const createTweetFeatures: Record<string, boolean> = JSON.parse(gqlFeatures);

export const gqlSearchFeatures = JSON.stringify({
  rweb_video_screen_enabled: false,
  profile_label_improvements_pcf_label_in_post_enabled: true,
  responsive_web_profile_redirect_enabled: false,
  rweb_tipjar_consumption_enabled: true,
  verified_phone_label_enabled: false,
  creator_subscriptions_tweet_preview_api_enabled: true,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  premium_content_api_read_enabled: false,
  communities_web_enable_tweet_community_results_fetch: true,
  c9s_tweet_anatomy_moderator_badge_enabled: true,
  responsive_web_grok_analyze_button_fetch_trends_enabled: false,
  responsive_web_grok_analyze_post_followups_enabled: true,
  responsive_web_jetfuel_frame: true,
  responsive_web_grok_share_attachment_enabled: true,
  responsive_web_grok_annotations_enabled: false,
  articles_preview_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  view_counts_everywhere_api_enabled: true,
  longform_notetweets_consumption_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  tweet_awards_web_tipping_enabled: false,
  content_disclosure_indicator_enabled: false,
  content_disclosure_ai_generated_indicator_enabled: false,
  responsive_web_grok_show_grok_translated_post: false,
  responsive_web_grok_analysis_button_from_backend: true,
  post_ctas_fetch_enabled: false,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: true,
  responsive_web_grok_image_annotation_enabled: true,
  responsive_web_grok_imagine_annotation_enabled: true,
  responsive_web_grok_community_note_auto_translation_is_enabled: false,
  responsive_web_enhance_cards_enabled: false,
});

export const gqlNitterSearchFeatures = JSON.stringify({
  android_ad_formats_media_component_render_overlay_enabled: false,
  android_graphql_skip_api_media_color_palette: false,
  android_professional_link_spotlight_display_enabled: false,
  articles_api_enabled: false,
  articles_preview_enabled: true,
  blue_business_profile_image_shape_enabled: false,
  c9s_tweet_anatomy_moderator_badge_enabled: true,
  commerce_android_shop_module_enabled: false,
  communities_web_enable_tweet_community_results_fetch: true,
  creator_subscriptions_quote_tweet_preview_enabled: false,
  creator_subscriptions_subscription_count_enabled: false,
  creator_subscriptions_tweet_preview_api_enabled: true,
  freedom_of_speech_not_reach_fetch_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  grok_android_analyze_trend_fetch_enabled: false,
  grok_translations_community_note_auto_translation_is_enabled: false,
  grok_translations_community_note_translation_is_enabled: false,
  grok_translations_post_auto_translation_is_enabled: false,
  grok_translations_timeline_user_bio_auto_translation_is_enabled: false,
  hidden_profile_likes_enabled: false,
  highlights_tweets_tab_ui_enabled: false,
  immersive_video_status_linkable_timestamps: false,
  interactive_text_enabled: false,
  longform_notetweets_consumption_enabled: true,
  longform_notetweets_inline_media_enabled: true,
  longform_notetweets_richtext_consumption_enabled: true,
  longform_notetweets_rich_text_read_enabled: true,
  mobile_app_spotlight_module_enabled: false,
  payments_enabled: false,
  post_ctas_fetch_enabled: true,
  premium_content_api_read_enabled: false,
  profile_label_improvements_pcf_label_in_post_enabled: true,
  profile_label_improvements_pcf_label_in_profile_enabled: false,
  responsive_web_edit_tweet_api_enabled: true,
  responsive_web_enhance_cards_enabled: false,
  responsive_web_graphql_exclude_directive_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_grok_analysis_button_from_backend: true,
  responsive_web_grok_analyze_button_fetch_trends_enabled: false,
  responsive_web_grok_analyze_post_followups_enabled: true,
  responsive_web_grok_annotations_enabled: true,
  responsive_web_grok_community_note_auto_translation_is_enabled: false,
  responsive_web_grok_image_annotation_enabled: true,
  responsive_web_grok_imagine_annotation_enabled: true,
  responsive_web_grok_share_attachment_enabled: true,
  responsive_web_grok_show_grok_translated_post: false,
  responsive_web_jetfuel_frame: true,
  responsive_web_media_download_video_enabled: false,
  responsive_web_profile_redirect_enabled: false,
  responsive_web_text_conversations_enabled: false,
  responsive_web_twitter_article_notes_tab_enabled: false,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  responsive_web_twitter_blue_verified_badge_is_enabled: true,
  rweb_lists_timeline_redesign_enabled: true,
  rweb_tipjar_consumption_enabled: true,
  rweb_video_screen_enabled: false,
  rweb_video_timestamps_enabled: false,
  spaces_2022_h2_clipping: true,
  spaces_2022_h2_spaces_communities: true,
  standardized_nudges_misinfo: true,
  subscriptions_feature_can_gift_premium: false,
  subscriptions_verification_info_enabled: true,
  subscriptions_verification_info_is_identity_verified_enabled: false,
  subscriptions_verification_info_reason_enabled: true,
  subscriptions_verification_info_verified_since_enabled: true,
  super_follow_badge_privacy_enabled: false,
  super_follow_exclusive_tweet_notifications_enabled: false,
  super_follow_tweet_api_enabled: false,
  super_follow_user_api_enabled: false,
  tweet_awards_web_tipping_enabled: false,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  tweetypie_unmention_optimization_enabled: false,
  unified_cards_ad_metadata_container_dynamic_card_content_query_enabled: false,
  unified_cards_destination_url_params_enabled: false,
  verified_phone_label_enabled: false,
  vibe_api_enabled: false,
  view_counts_everywhere_api_enabled: true,
  hidden_profile_subscriptions_enabled: false
});

export const gqlModernSearchFeatures = JSON.stringify({
  rweb_video_screen_enabled: true,
  profile_label_improvements_pcf_label_in_post_enabled: true,
  responsive_web_profile_redirect_enabled: true,
  rweb_tipjar_consumption_enabled: true,
  verified_phone_label_enabled: true,
  creator_subscriptions_tweet_preview_api_enabled: true,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: true,
  premium_content_api_read_enabled: true,
  communities_web_enable_tweet_community_results_fetch: true,
  c9s_tweet_anatomy_moderator_badge_enabled: true,
  responsive_web_grok_analyze_button_fetch_trends_enabled: true,
  responsive_web_grok_analyze_post_followups_enabled: true,
  responsive_web_jetfuel_frame: true,
  responsive_web_grok_share_attachment_enabled: true,
  responsive_web_grok_annotations_enabled: true,
  articles_preview_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  view_counts_everywhere_api_enabled: true,
  longform_notetweets_consumption_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  tweet_awards_web_tipping_enabled: true,
  content_disclosure_indicator_enabled: true,
  content_disclosure_ai_generated_indicator_enabled: true,
  responsive_web_grok_show_grok_translated_post: true,
  responsive_web_grok_analysis_button_from_backend: true,
  post_ctas_fetch_enabled: true,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: true,
  responsive_web_grok_image_annotation_enabled: true,
  responsive_web_grok_imagine_annotation_enabled: true,
  responsive_web_grok_community_note_auto_translation_is_enabled: true,
  responsive_web_enhance_cards_enabled: true
});

export const modernSearchFieldToggles = JSON.stringify({
  withPayments: false,
  withAuxiliaryUserLabels: false,
  withArticleRichContentState: false,
  withArticlePlainText: false,
  withArticleSummaryText: false,
  withArticleVoiceOver: false,
  withGrokAnalyze: false,
  withDisallowedReplyControls: false
});

// --- Variable Templates ---

export const tweetVars = (postId: string, cursor: string) =>
  JSON.stringify({
    postId,
    ...(cursor ? { cursor } : {}),
    includeHasBirdwatchNotes: false,
    includePromotedContent: false,
    withBirdwatchNotes: true,
    withVoice: false,
    withV2Timeline: true,
  });

export const tweetDetailVars = (focalTweetId: string, cursor: string) =>
  JSON.stringify({
    focalTweetId,
    ...(cursor ? { cursor } : {}),
    referrer: "profile",
    with_rux_injections: false,
    includePromotedContent: false,
    withCommunity: true,
    withQuickPromoteEligibilityTweetFields: false,
    withBirdwatchNotes: true,
    withVoice: true,
  });

export const tweetEditHistoryVars = (tweetId: string) =>
  JSON.stringify({
    tweetId,
    withQuickPromoteEligibilityTweetFields: true,
  });

export const tweetResultVars = (tweetId: string) =>
  JSON.stringify({
    tweetId,
    withCommunity: false,
    includePromotedContent: false,
    withVoice: false,
  });

export const restIdVars = (restId: string, cursor: string, count: number) =>
  JSON.stringify({
    rest_id: restId,
    ...(cursor ? { cursor } : {}),
    count,
  });

export const userMediaVars = (userId: string, cursor: string, count: number) =>
  JSON.stringify({
    userId,
    ...(cursor ? { cursor } : {}),
    count,
    includePromotedContent: false,
    withClientEventToken: false,
    withBirdwatchNotes: false,
    withVoice: true,
  });

export const followVars = (userId: string, cursor: string, count = 50) =>
  JSON.stringify({
    userId,
    count,
    ...(cursor ? { cursor } : {}),
    includePromotedContent: false,
  });

export const homeTimelineVars = (cursor = "", count = 40) =>
  JSON.stringify({
    count,
    ...(cursor ? { cursor } : {}),
    includePromotedContent: false,
    latestControlAvailable: true,
    requestContext: "launch",
    withCommunity: true,
    seenTweetIds: [],
  });

export const userTweetsVars = (userId: string, cursor: string) =>
  JSON.stringify({
    userId,
    ...(cursor ? { cursor } : {}),
    count: 20,
    includePromotedContent: false,
    withQuickPromoteEligibilityTweetFields: true,
    withVoice: true,
  });

export const userTweetsAndRepliesVars = (userId: string, cursor: string) =>
  JSON.stringify({
    userId,
    ...(cursor ? { cursor } : {}),
    count: 20,
    includePromotedContent: false,
    withCommunity: true,
    withVoice: true,
  });

export const userFieldToggles = JSON.stringify({
  withPayments: true,
  withAuxiliaryUserLabels: true,
  withArticleRichContentState: true,
  withArticlePlainText: true,
  withArticleSummaryText: true,
  withArticleVoiceOver: true,
  withGrokAnalyze: true,
  withDisallowedReplyControls: true
});

export const mobileUserTweetsFeatures = JSON.stringify({
  withArticlePlainText: false,
});

export const pinnedTimelinesFeatures = JSON.stringify({"rweb_video_screen_enabled":true,"profile_label_improvements_pcf_label_in_post_enabled":true,"responsive_web_profile_redirect_enabled":true,"rweb_tipjar_consumption_enabled":true,"verified_phone_label_enabled":true,"creator_subscriptions_tweet_preview_api_enabled":true,"responsive_web_graphql_timeline_navigation_enabled":true,"responsive_web_graphql_skip_user_profile_image_extensions_enabled":false,"premium_content_api_read_enabled":false,"communities_web_enable_tweet_community_results_fetch":true,"c9s_tweet_anatomy_moderator_badge_enabled":true,"responsive_web_grok_analyze_button_fetch_trends_enabled":false,"responsive_web_grok_analyze_post_followups_enabled":true,"responsive_web_jetfuel_frame":false,"responsive_web_grok_share_attachment_enabled":true,"responsive_web_grok_annotations_enabled":false,"articles_preview_enabled":true,"responsive_web_edit_tweet_api_enabled":true,"graphql_is_translatable_rweb_tweet_is_translatable_enabled":true,"view_counts_everywhere_api_enabled":true,"longform_notetweets_consumption_enabled":true,"responsive_web_twitter_article_tweet_consumption_enabled":false,"tweet_awards_web_tipping_enabled":false,"content_disclosure_indicator_enabled":false,"content_disclosure_ai_generated_indicator_enabled":false,"responsive_web_grok_show_grok_translated_post":false,"responsive_web_grok_analysis_button_from_backend":false,"post_ctas_fetch_enabled":false,"freedom_of_speech_not_reach_fetch_enabled":true,"standardized_nudges_misinfo":true,"tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled":true,"longform_notetweets_rich_text_read_enabled":true,"longform_notetweets_inline_media_enabled":true,"responsive_web_grok_image_annotation_enabled":false,"responsive_web_grok_imagine_annotation_enabled":false,"responsive_web_grok_community_note_auto_translation_is_enabled":false,"responsive_web_enhance_cards_enabled":false});

export const tweetResultFieldToggles = JSON.stringify({
  withArticleRichContentState: true,
  withArticlePlainText: false,
  withGrokAnalyze: false,
  withDisallowedReplyControls: false,
});

export const tweetDetailFieldToggles = JSON.stringify({
  withArticleRichContentState: true,
  withArticlePlainText: false,
  withGrokAnalyze: false,
  withDisallowedReplyControls: false,
});

export const searchFieldToggles = JSON.stringify({
  withPayments: false,
  withAuxiliaryUserLabels: false,
  withArticleRichContentState: false,
  withArticlePlainText: false,
  withArticleSummaryText: false,
  withArticleVoiceOver: false,
  withGrokAnalyze: false,
  withDisallowedReplyControls: false,
});

// --- URL Helpers ---

export const graphqlBase = "https://x.com/i/api/graphql/";
export const https = "https://";
export const twimg = "pbs.twimg.com/";

export const smallWebp = "?format=webp&name=small";
export const mediumWebp = "?format=webp&name=medium";

// --- Self-healing query-id overrides ---
//
// X periodically rotates the persisted-query id that prefixes each GraphQL
// endpoint (the "<22charId>/<OperationName>" strings above). When that happens
// the hard-coded id starts returning 404. `query-resolver.ts` resolves the live
// id from X's web bundle and records it here via `setQueryIdOverride`; the
// client then transparently swaps it in for the original. In-memory only, never
// persisted, empty on the happy path.
export const queryIdOverrides: Record<string, string> = {};

/** Record a freshly-resolved persisted-query id for an operation (in-memory). */
export function setQueryIdOverride(operationName: string, queryId: string): void {
  queryIdOverrides[operationName] = queryId;
}

/**
 * Given a "<queryId>/<OperationName>" GraphQL endpoint, swap in a runtime
 * override id if one has been resolved for that operation. Returns the endpoint
 * unchanged when there is no override — a single map lookup on the hot path.
 */
export function withQueryIdOverride(endpoint: string): string {
  const slash = endpoint.indexOf("/");
  if (slash <= 0) return endpoint;
  const op = endpoint.slice(slash + 1);
  const override = queryIdOverrides[op];
  return override ? `${override}/${op}` : endpoint;
}

export function genParams(variables: string, fieldToggles = "", customFeatures?: string): [string, string][] {
  const params: [string, string][] = [
    ["variables", variables],
    ["features", customFeatures || gqlFeatures],
  ];
  if (fieldToggles) {
    params.push(["fieldToggles", fieldToggles]);
  }
  return params;
}

export const followersFeatures = JSON.stringify({
  rweb_video_screen_enabled: true,
  rweb_cashtags_enabled: true,
  profile_label_improvements_pcf_label_in_post_enabled: true,
  responsive_web_profile_redirect_enabled: true,
  rweb_tipjar_consumption_enabled: true,
  verified_phone_label_enabled: true,
  creator_subscriptions_tweet_preview_api_enabled: true,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  premium_content_api_read_enabled: false,
  communities_web_enable_tweet_community_results_fetch: true,
  c9s_tweet_anatomy_moderator_badge_enabled: true,
  responsive_web_grok_analyze_button_fetch_trends_enabled: false,
  responsive_web_grok_analyze_post_followups_enabled: true,
  rweb_cashtags_composer_attachment_enabled: true,
  responsive_web_jetfuel_frame: true,
  responsive_web_grok_share_attachment_enabled: true,
  responsive_web_grok_annotations_enabled: true,
  articles_preview_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  rweb_conversational_replies_downvote_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  view_counts_everywhere_api_enabled: true,
  longform_notetweets_consumption_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  content_disclosure_indicator_enabled: true,
  content_disclosure_ai_generated_indicator_enabled: true,
  responsive_web_grok_show_grok_translated_post: false,
  responsive_web_grok_analysis_button_from_backend: true,
  post_ctas_fetch_enabled: true,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: true,
  responsive_web_grok_image_annotation_enabled: true,
  responsive_web_grok_imagine_annotation_enabled: true,
  responsive_web_grok_community_note_auto_translation_is_enabled: false,
  responsive_web_enhance_cards_enabled: false
});
