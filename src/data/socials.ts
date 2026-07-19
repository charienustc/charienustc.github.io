export interface Social {
  name: string;
  url: string;
  /** 图标 key,对应 LinkButton 内置的 svg */
  icon: 'github' | 'twitter' | 'mail' | 'rss' | 'weibo' | 'bilibili' | 'zhihu' | 'link';
  handle?: string;
}

export const socials: Social[] = [
  { name: 'GitHub', url: 'https://github.com/charienustc', icon: 'github', handle: '@charienustc' },
  { name: '微博', url: 'https://weibo.com/<username>', icon: 'weibo', handle: '@<username>' },
  { name: 'Email', url: 'mailto:charien@mail.ustc.edu.cn', icon: 'mail', handle: 'charien@mail.ustc.edu.cn' },
];
