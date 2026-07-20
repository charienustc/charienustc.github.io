// 社交链接数据。实际内容在 socials.json(后台可直接修改)。
import data from './socials.json';

export interface Social {
  name: string;
  url: string;
  /** 图标 key */
  icon: 'github' | 'twitter' | 'mail' | 'rss' | 'weibo' | 'bilibili' | 'zhihu' | 'link';
  handle?: string;
}

export const socials: Social[] = data as Social[];
