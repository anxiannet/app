
import { Role } from '@/lib/types';

export const ROLES_CONFIG: { [key: number]: { [Role.Undercover]: number, [Role.Coach]: number, [Role.TeamMember]: number } } = {
  5: { [Role.Undercover]: 2, [Role.Coach]: 1, [Role.TeamMember]: 2 },
  6: { [Role.Undercover]: 2, [Role.Coach]: 1, [Role.TeamMember]: 3 },
  7: { [Role.Undercover]: 3, [Role.Coach]: 1, [Role.TeamMember]: 3 },
  8: { [Role.Undercover]: 3, [Role.Coach]: 1, [Role.TeamMember]: 4 },
  9: { [Role.Undercover]: 3, [Role.Coach]: 1, [Role.TeamMember]: 5 },
  10: { [Role.Undercover]: 4, [Role.Coach]: 1, [Role.TeamMember]: 5 },
};

export const MISSIONS_CONFIG: { [playerCount: number]: number[] } = {
  5: [2, 3, 2, 3, 3],
  6: [2, 3, 4, 3, 4],
  7: [2, 3, 3, 4, 4], 
  8: [3, 4, 4, 5, 5], 
  9: [3, 4, 4, 5, 5], 
  10: [3, 4, 4, 5, 5], 
};

export const MIN_PLAYERS_TO_START = 5;
export const TOTAL_ROUNDS_PER_GAME = 5;
export const MAX_CAPTAIN_CHANGES_PER_ROUND = 5;

export const HONOR_OF_KINGS_HERO_NAMES = [
  "亚瑟", "安琪拉", "白起", "不知火舞", "妲己", "狄仁杰", "典韦", "貂蝉", "东皇太一", "盾山",
  "伽罗", "关羽", "后羿", "花木兰", "黄忠", "铠", "兰陵王", "老夫子", "廉颇", "刘邦",
  "刘备", "刘禅", "鲁班七号", "吕布", "马可波罗", "芈月", "米莱狄", "明世隐", "墨子", "哪吒",
  "娜可露露", "盘古", "裴擒虎", "公孙离", "上官婉儿", "沈梦溪", "孙膑", "孙尚香", "孙悟空", "王昭君",
  "夏侯惇", "项羽", "小乔", "杨戬", "杨玉环", "瑶", "弈星", "虞姬", "元歌", "云中君",
  "张飞", "张良", "赵云", "甄姬", "钟馗", "钟无艳", "周瑜", "庄周", "诸葛亮", "阿轲"
];

export const FAILURE_REASONS_LIST_FOR_FALLBACK = [
  "阵容不合理", "节奏不同步", "资源利用差", "频繁送头", "技能释放错误", "经济差距",
  "盲目开团 / 不开团", "视野不足", "判断失误", "挂机、演员、互喷",
  "指责队友导致配合断裂", "网络卡顿 / 延迟高", "掉线、闪退", "匹配机制不平衡"
];
