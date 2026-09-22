// 科大常用链接数据。
import data from './ustc-links.json';

export interface UstcLink {
  name: string;
  url: string;
  icon: 'github' | 'twitter' | 'mail' | 'rss' | 'weibo' | 'bilibili' | 'zhihu' | 'link';
  handle?: string;
}

export const ustcLinks: UstcLink[] = data as UstcLink[];
