
import { Role, type GameRoom, RoomMode } from '@/lib/types';

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
  7: [2, 3, 3, 4, 4], // Round 4 needs 2 fails
  8: [3, 4, 4, 5, 5], // Round 4 needs 2 fails
  9: [3, 4, 4, 5, 5], // Round 4 needs 2 fails
  10: [3, 4, 4, 5, 5], // Round 4 needs 2 fails
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

export const PRE_GENERATED_AVATARS: string[] = [
  "https://placehold.co/100x100/E6A4B4/white?text=A",
  "https://placehold.co/100x100/99BC85/white?text=B",
  "https://placehold.co/100x100/F3B95F/white?text=C",
  "https://placehold.co/100x100/7469B6/white?text=D",
  "https://placehold.co/100x100/FFC0D9/white?text=E",
  "https://placehold.co/100x100/86B6F6/white?text=F",
  "https://placehold.co/100x100/D7E4C0/white?text=G",
  "https://placehold.co/100x100/F2C18D/white?text=H",
  "https://placehold.co/100x100/ADA2FF/white?text=I",
  "https://placehold.co/100x100/F99417/white?text=J",
  "https://placehold.co/100x100/5DEBD7/black?text=K",
  "https://placehold.co/100x100/C5EBAA/black?text=L",
  "https://placehold.co/100x100/FFB84C/black?text=M",
  "https://placehold.co/100x100/E1AFD1/black?text=N",
  "https://placehold.co/100x100/91C8E4/black?text=P",
];

// Templates for standard online/manual games
export const STANDARD_PRESET_TEMPLATES: Array<Partial<GameRoom> & { id: string; name: string; maxPlayers: number; mode: RoomMode.ManualInput | RoomMode.Online }> = [
  { id: 'preset-5-manual', name: '5人手动局', maxPlayers: 5, mode: RoomMode.ManualInput, missionPlayerCounts: MISSIONS_CONFIG[5], totalRounds: TOTAL_ROUNDS_PER_GAME, maxCaptainChangesPerRound: MAX_CAPTAIN_CHANGES_PER_ROUND },
  { id: 'preset-6-manual', name: '6人手动局', maxPlayers: 6, mode: RoomMode.ManualInput, missionPlayerCounts: MISSIONS_CONFIG[6], totalRounds: TOTAL_ROUNDS_PER_GAME, maxCaptainChangesPerRound: MAX_CAPTAIN_CHANGES_PER_ROUND },
  { id: 'preset-7-manual', name: '7人手动局', maxPlayers: 7, mode: RoomMode.ManualInput, missionPlayerCounts: MISSIONS_CONFIG[7], totalRounds: TOTAL_ROUNDS_PER_GAME, maxCaptainChangesPerRound: MAX_CAPTAIN_CHANGES_PER_ROUND },
  { id: 'preset-8-manual', name: '8人手动局', maxPlayers: 8, mode: RoomMode.ManualInput, missionPlayerCounts: MISSIONS_CONFIG[8], totalRounds: TOTAL_ROUNDS_PER_GAME, maxCaptainChangesPerRound: MAX_CAPTAIN_CHANGES_PER_ROUND },
  { id: 'preset-9-manual', name: '9人手动局', maxPlayers: 9, mode: RoomMode.ManualInput, missionPlayerCounts: MISSIONS_CONFIG[9], totalRounds: TOTAL_ROUNDS_PER_GAME, maxCaptainChangesPerRound: MAX_CAPTAIN_CHANGES_PER_ROUND },
  { id: 'preset-10-manual', name: '10人手动局', maxPlayers: 10, mode: RoomMode.ManualInput, missionPlayerCounts: MISSIONS_CONFIG[10], totalRounds: TOTAL_ROUNDS_PER_GAME, maxCaptainChangesPerRound: MAX_CAPTAIN_CHANGES_PER_ROUND },
];


// Templates for Offline Keyword games
// These define the static part of the preset.
// Keyword theme and specific keywords are generated dynamically per game instance.
export const OFFLINE_KEYWORD_PRESET_TEMPLATES: Array<{
  id: string;
  name: string;
  playerCount: number;
  mode: RoomMode.OfflineKeyword;
  players: Array<{ name: string; role: Role }>; // Pre-defined player names and roles
}> = [
  {
    id: 'offline-keyword-5',
    name: '5人暗语局',
    playerCount: 5,
    mode: RoomMode.OfflineKeyword,
    players: [
      { name: "角色A", role: Role.TeamMember },
      { name: "角色B", role: Role.TeamMember },
      { name: "角色C", role: Role.Coach },
      { name: "角色D", role: Role.Undercover },
      { name: "角色E", role: Role.Undercover },
    ],
  },
  {
    id: 'offline-keyword-6',
    name: '6人暗语局',
    playerCount: 6,
    mode: RoomMode.OfflineKeyword,
    players: [
      { name: "角色A", role: Role.TeamMember },
      { name: "角色B", role: Role.TeamMember },
      { name: "角色C", role: Role.TeamMember },
      { name: "角色D", role: Role.Coach },
      { name: "角色E", role: Role.Undercover },
      { name: "角色F", role: Role.Undercover },
    ],
  },
  // Add templates for 7, 8, 9, 10 players similarly
  {
    id: 'offline-keyword-7',
    name: '7人暗语局',
    playerCount: 7,
    mode: RoomMode.OfflineKeyword,
    players: ROLES_CONFIG[7] ? // Dynamically create player list based on ROLES_CONFIG
        Object.entries(ROLES_CONFIG[7]).flatMap(([role, count]) => 
            Array(count).fill(null).map((_, i) => ({ name: `角色${String.fromCharCode(65 + (Object.entries(ROLES_CONFIG[7]).slice(0, Object.keys(ROLES_CONFIG[7]).indexOf(role as Role)).reduce((acc,[,val]) => acc+val, 0) + i))}`, role: role as Role }))
        )
        : [] // Fallback if ROLES_CONFIG doesn't have 7
  },
  {
    id: 'offline-keyword-8',
    name: '8人暗语局',
    playerCount: 8,
    mode: RoomMode.OfflineKeyword,
    players: ROLES_CONFIG[8] ?
        Object.entries(ROLES_CONFIG[8]).flatMap(([role, count]) => 
            Array(count).fill(null).map((_, i) => ({ name: `角色${String.fromCharCode(65 + (Object.entries(ROLES_CONFIG[8]).slice(0, Object.keys(ROLES_CONFIG[8]).indexOf(role as Role)).reduce((acc,[,val]) => acc+val, 0) + i))}`, role: role as Role }))
        )
        : []
  },
  {
    id: 'offline-keyword-9',
    name: '9人暗语局',
    playerCount: 9,
    mode: RoomMode.OfflineKeyword,
    players: ROLES_CONFIG[9] ?
        Object.entries(ROLES_CONFIG[9]).flatMap(([role, count]) => 
            Array(count).fill(null).map((_, i) => ({ name: `角色${String.fromCharCode(65 + (Object.entries(ROLES_CONFIG[9]).slice(0, Object.keys(ROLES_CONFIG[9]).indexOf(role as Role)).reduce((acc,[,val]) => acc+val, 0) + i))}`, role: role as Role }))
        )
        : []
  },
  {
    id: 'offline-keyword-10',
    name: '10人暗语局',
    playerCount: 10,
    mode: RoomMode.OfflineKeyword,
    players: ROLES_CONFIG[10] ?
        Object.entries(ROLES_CONFIG[10]).flatMap(([role, count]) => 
            Array(count).fill(null).map((_, i) => ({ name: `角色${String.fromCharCode(65 + (Object.entries(ROLES_CONFIG[10]).slice(0, Object.keys(ROLES_CONFIG[10]).indexOf(role as Role)).reduce((acc,[,val]) => acc+val, 0) + i))}`, role: role as Role }))
        )
        : []
  },
];

export const ALL_PRESET_TEMPLATES = [
    ...STANDARD_PRESET_TEMPLATES,
    // ...OFFLINE_KEYWORD_PRESET_TEMPLATES // Will be merged in lobby page
];
