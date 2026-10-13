# @mdsvex/plugin-page-data

## 0.1.0-next.0

### Minor Changes

- [#1114](https://github.com/pngwn/MDsveX/pull/1114) [`e65ddc0`](https://github.com/pngwn/MDsveX/commit/e65ddc007f05b8979ce2ee839ac6bcba094034c0) Thanks [@pngwn](https://github.com/pngwn)! - New package: page data. It works out a reading time, an excerpt, a title and an edit url for each document and leaves them in its plugin data, under one key.

  ```js
  import { page_data } from '@mdsvex/plugin-page-data';

  mdsvex({
  	plugins: [
  		page_data({ edit_url: 'https://github.com/you/site/edit/main/' }),
  	],
  });
  ```

  ```js
  import Post, { plugin_data } from './post.svx';

  plugin_data.page;
  // { title, excerpt, words, minutes, edit_url }
  ```

  - `words` counts the prose and leaves code blocks out. Each Chinese, Japanese or Korean character is a word. `minutes` is the words over `words_per_minute`, 200 by default, rounded up as the `reading-time` package shows it.
  - `excerpt` is the first paragraph, or everything before a `<!-- more -->` comment, as plain text. `max_length` cuts it where a word ends.
  - `title` is the text of the first `#` heading, and is only set when the frontmatter has no `title`. `metadata` is never changed.
  - `edit_url` is the base you give and the path of the document, and is off without a base.
  - Each part can be turned off. A `?data` import gives all of it without rendering the document, for a page that lists posts.

### Patch Changes

- Updated dependencies [[`6e921ad`](https://github.com/pngwn/MDsveX/commit/6e921adadb13a01894c48a1a8ba8e4cbac1a5016), [`6c5901c`](https://github.com/pngwn/MDsveX/commit/6c5901c1eb87d10a2f43c835a10930a9dd5c0d27), [`364b172`](https://github.com/pngwn/MDsveX/commit/364b17205ef9a73e0fb037b7da0b217018cc097d), [`89bf377`](https://github.com/pngwn/MDsveX/commit/89bf3776a22003ab42517b9b8a542507fce6f03b), [`47197f7`](https://github.com/pngwn/MDsveX/commit/47197f7057de0ff90d16b9c4d407450b5f68a2ca), [`b1ccd82`](https://github.com/pngwn/MDsveX/commit/b1ccd825b1cb05c59491880a112490a87b5c0d1d), [`f1f8895`](https://github.com/pngwn/MDsveX/commit/f1f88950b8213b0bcacb5d47015b0e8f60146110), [`edaaa59`](https://github.com/pngwn/MDsveX/commit/edaaa59bda7e388248428eb7b6459442c7ddd216), [`c085c85`](https://github.com/pngwn/MDsveX/commit/c085c856084f6346748a325b31fa50915413872a), [`34aae13`](https://github.com/pngwn/MDsveX/commit/34aae13494d0f7678647cba02f223f68d56e08a2), [`78c552f`](https://github.com/pngwn/MDsveX/commit/78c552f8951c9186ec5b33934477d31e6028b627), [`14e9951`](https://github.com/pngwn/MDsveX/commit/14e9951b3b9de574ca0cc9c9062b48328586f1b4), [`26244e2`](https://github.com/pngwn/MDsveX/commit/26244e20b1ec22fa31ba8e126c7157465459ab47), [`26244e2`](https://github.com/pngwn/MDsveX/commit/26244e20b1ec22fa31ba8e126c7157465459ab47), [`56c5c71`](https://github.com/pngwn/MDsveX/commit/56c5c71c9184b7a9362ac39bd3bbaee5412813b4), [`3f7ad22`](https://github.com/pngwn/MDsveX/commit/3f7ad22711f914a27338428e8a9fbbc24c03b33e), [`636d9b9`](https://github.com/pngwn/MDsveX/commit/636d9b9c065a29007e9581151be1f6c061f256e4), [`524cf8a`](https://github.com/pngwn/MDsveX/commit/524cf8a1fe311c071aa2937950190891c43df0a0), [`9d4c1a4`](https://github.com/pngwn/MDsveX/commit/9d4c1a419c807a856aa4bed122bbb19b746b1738), [`542d604`](https://github.com/pngwn/MDsveX/commit/542d604fabf70b0dcb52b8140ed066843dc18916), [`50e0b8c`](https://github.com/pngwn/MDsveX/commit/50e0b8ccc97885e0ca7eed53c075bfaed7969b23), [`524cf8a`](https://github.com/pngwn/MDsveX/commit/524cf8a1fe311c071aa2937950190891c43df0a0), [`a02a0ae`](https://github.com/pngwn/MDsveX/commit/a02a0aefe318b90c630df9818268f5588eaf476d), [`a8473b4`](https://github.com/pngwn/MDsveX/commit/a8473b453958c8619744cb0d8c8c694f515961bc), [`9842f87`](https://github.com/pngwn/MDsveX/commit/9842f872de3f911bbaf54a56a1529d6a1445dccc), [`9a8b94d`](https://github.com/pngwn/MDsveX/commit/9a8b94da69804114e2cac93fc82cd12094592662), [`a3dc415`](https://github.com/pngwn/MDsveX/commit/a3dc415629e6ca782fa1e36687c384f56a569096), [`c37520f`](https://github.com/pngwn/MDsveX/commit/c37520f5d0ba21dc7647e4a31cedc723636a36dd), [`6b67a44`](https://github.com/pngwn/MDsveX/commit/6b67a4478687548dc1176fe659f8c917828c67c5), [`a3dc415`](https://github.com/pngwn/MDsveX/commit/a3dc415629e6ca782fa1e36687c384f56a569096), [`a3dc415`](https://github.com/pngwn/MDsveX/commit/a3dc415629e6ca782fa1e36687c384f56a569096), [`cfc1ab0`](https://github.com/pngwn/MDsveX/commit/cfc1ab0468d82dc54d57ff525f542402a92423ee), [`9b8d968`](https://github.com/pngwn/MDsveX/commit/9b8d9681b17874aba4188e597c8b0d5075d155ed), [`9df619b`](https://github.com/pngwn/MDsveX/commit/9df619b02dc35693f47d4e0751df4c72f20ae491), [`e09ab81`](https://github.com/pngwn/MDsveX/commit/e09ab81451d98d6dd8d9b77f2f4409d169ae9a49), [`0462e67`](https://github.com/pngwn/MDsveX/commit/0462e678afdb484b031e7ddb4c7086fdee273f27), [`fc56ba8`](https://github.com/pngwn/MDsveX/commit/fc56ba892e7068b378e350c29cfb52be6c5d48b1), [`a3b2de5`](https://github.com/pngwn/MDsveX/commit/a3b2de5e01e4e8cb2f56bf06ad6a163c035e980b), [`7dfb9c9`](https://github.com/pngwn/MDsveX/commit/7dfb9c9c7301e96e4780c03ff45b04dbee6e92c4), [`aa06e2f`](https://github.com/pngwn/MDsveX/commit/aa06e2fdd972cfef890313d15a8a22b95d31bd2e), [`68e2a59`](https://github.com/pngwn/MDsveX/commit/68e2a59528b92a1c43ed961a69f10e0eaed1bee3), [`6985317`](https://github.com/pngwn/MDsveX/commit/6985317ea53b10f5cf99d6a5d6142dd6bcb31e41), [`3ca3b52`](https://github.com/pngwn/MDsveX/commit/3ca3b525050c5874ac9ff7130033fe00d0112cba), [`19fc058`](https://github.com/pngwn/MDsveX/commit/19fc05846c53942ec53ca75baabecd02ed5da076)]:
  - mdsvex@1.0.0-next.2
