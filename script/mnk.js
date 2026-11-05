// noinspection SpellCheckingInspection
// MNK
// import config from './3.js'

const countryRegex = {
    HK: /🇭🇰|香港/i,
    TW: /🇹🇼|台湾/i,
    JP: /🇯🇵|日本/i,
    SG: /🇸🇬|新加坡/i,
    US: /🇺🇸|美国/i,
    DE: /🇩🇪|德国/i,
    UK: /🇬🇧|英国/i,
    NL: /🇳🇱|荷兰/i,
    RU: /🇷🇺|俄罗斯/i,
    VN: /🇻🇳|越南/i
};

const externalNodes = addExternalNodes();
const externalNames = [];
for (const {name} of externalNodes) {
    externalNames.push(name);
}

const countries = [...Object.keys(countryRegex), "Other"];
const testURL = "https://www.gstatic.com/generate_204";

const main = function (config) {
    // 删除流量、重置时间、套餐到期等说明节点。
    config.proxies = (config.proxies || []).filter(
        ({name}) => !/官网|试验|更新|套餐|剩余|流量|重置|到期|IPV6/i.test(name)
    );

    const nodes = classifyNodes(config.proxies);
    console.log(nodes)
    config.proxies.push(...externalNodes);
    config["proxy-groups"] = createProxyGroups(nodes);
    config.rules = [...getRules(), "MATCH,Default"];

    return config;
};

function classifyNodes(proxies) {
    const nodes = {
        All: proxies.map(({name}) => name),
        HighMultiplier: [],
        ByCountry: Object.fromEntries(countries.map((country) => [country, []])),
    };

    for (const {name} of proxies) {
        const multiplier = name.match(/(?:^|[-\s])([0-9]+(?:\.[0-9]+)?)x(?:\s|\||-|$)/i);
        if (multiplier && Number(multiplier[1]) > 3) {
            nodes.HighMultiplier.push(name);
            continue;
        }

        const country = countries.find(
            (item) => item !== "Other" && countryRegex[item].test(name)
        ) || "Other";

        nodes.ByCountry[country].push(name);
    }

    return nodes;
}

function createProxyGroups(nodes) {
    const {All} = nodes;
    const {HighMultiplier} = nodes;
    const {HK, TW, JP, SG, US, DE, UK, NL, Other} = nodes.ByCountry;


    const defaultGroup = {
        name: "Default",
        type: "select",
        proxies: [
            "Auto",
            ...countries.flatMap((country) => nodes.ByCountry[country]),
            ...(HighMultiplier.length > 0 ? ["高倍率"] : []),
        ],
    };

    const autoGroup = {name: "Auto", type: "fallback", proxies: [...HK, ...TW, ...SG, ...JP, ...US, ...DE, ...Other]};
    const highMultiplierGroup = {name: "高倍率", type: "select", proxies: HighMultiplier};

    const serviceGroups = [
        {name: "YouTube", type: "url-test", proxies: [...HK, ...TW, ...SG, ...JP, ...US].filter(n => /1.0|1.2/i.test(n))},
        {name: "Google", type: "url-test", proxies: [...TW, ...SG, ...JP, ...US, ...DE]},
        {name: "Gemini", type: "fallback", proxies: [...TW, ...SG, ...JP, ...US, ...DE]},
        {name: "ChatGPT", type: "fallback", proxies: [...JP, ...US, ...TW, ...DE]},
        {name: "X", type: "fallback", proxies: [...US, ...JP, ...SG, ...TW, ...HK, ...DE].filter(n => /1.0|1.2|1.5|2.0/i.test(n))},
        {name: "TikTok", type: "fallback", proxies: [...US, ...TW, ...JP, ...SG, ...HK].filter(n => /1.0|1.2|1.5|2.0/i.test(n))},
        {name: "Telegram", type: "url-test", proxies: [...SG, ...JP, ...TW, ...US, ...HK, ...DE]},
        {name: "BBC", type: "fallback", proxies: [...UK, ...DE, ...NL, ...JP, ...SG, ...US, ...HK]},
        {name: "Github", type: "fallback", proxies: [...HK, ...SG, ...JP, ...TW, ...US, ...DE]},
        {name: "Twitch", type: "fallback", proxies: [...HK, ...SG, ...JP, ...TW, ...US, ...DE].filter(n => /1.0|1.2|1.5|2.0/i.test(n))},
    ];

    const withTest = (group) => {
        const result = {
            ...group,
            url: testURL,
            interval: 300,
            timeout: 3000,
            lazy: true,
            "max-failed-times": 2,
        };
        switch (group.type) {
            case "select":
                return group;
            case "fallback":
                return result;
            case "url-test":
                result.tolerance = 20;
                return result;
        }
    };

    const allGroups = [autoGroup, highMultiplierGroup, ...serviceGroups];
    const validGroups = allGroups
        .filter((group) => group.proxies.length > 0)
        .map((group) => withTest(group));

    const validGroupNames = new Set(validGroups.map(({name}) => name));
    const validNodeNames = new Set(All);
    const validDefaultGroup = {
        ...defaultGroup,
        proxies: defaultGroup.proxies.filter((name) =>
            name === "DIRECT" || validGroupNames.has(name) || validNodeNames.has(name)
        )
    };

    return [validDefaultGroup, ...validGroups];
}

function getRules() {
    return [
        // YouTube / 沉浸式翻译
        "DOMAIN-SUFFIX,music.youtube.com,YouTube",
        "DOMAIN-SUFFIX,googlevideo.com,YouTube",
        "DOMAIN-SUFFIX,ggpht.com,YouTube",
        "DOMAIN-SUFFIX,ytimg.com,YouTube",
        "DOMAIN-KEYWORD,youtube,YouTube",
        "DOMAIN-SUFFIX,immersivetranslate.com,YouTube",
        "DOMAIN,yt3.googleusercontent.com,YouTube",

        // AI
        "DOMAIN-KEYWORD,chatgpt,ChatGPT",
        "DOMAIN-KEYWORD,openai,ChatGPT",
        "DOMAIN-SUFFIX,oaistatic.com,ChatGPT",
        "DOMAIN-SUFFIX,oaiusercontent.com,ChatGPT",
        "DOMAIN-SUFFIX,gemini.google.com,Gemini",
        "DOMAIN-KEYWORD,gemini,Gemini",


        // Google
        "DOMAIN-SUFFIX,services.googleapis.cn,Google",
        "DOMAIN-SUFFIX,gstatic.com,Google",
        "DOMAIN-KEYWORD,google,Google",
        "DOMAIN-KEYWORD,gmail,Google",

        // 海外服务
        "DOMAIN-KEYWORD,tiktok,TikTok",
        "DOMAIN-SUFFIX,chinadigitaltimes.net,Google",
        "DOMAIN-KEYWORD,github,Github",
        "DOMAIN-SUFFIX,bbc.com,BBC",
        "DOMAIN-SUFFIX,bbc.co.uk,BBC",
        "DOMAIN-SUFFIX,bbci.co.uk,BBC",
        "DOMAIN-SUFFIX,x.com,X",
        "DOMAIN-SUFFIX,twitter.com,X",
        "DOMAIN-SUFFIX,twimg.com,X",
        "DOMAIN-SUFFIX,t.co,X",
        "DOMAIN-SUFFIX,twitch.tv,Twitch",
        "DOMAIN-SUFFIX,ttvnw.net,Twitch",
        "DOMAIN-SUFFIX,jtvnw.net,Twitch",
        "DOMAIN-SUFFIX,live-video.net,Twitch",

        // Telegram
        "DOMAIN-SUFFIX,telegram.org,Telegram",
        "DOMAIN-SUFFIX,telegram.me,Telegram",
        "DOMAIN-SUFFIX,t.me,Telegram",
        "IP-CIDR,91.108.0.0/16,Telegram,no-resolve",
        "IP-CIDR,109.239.140.0/24,Telegram,no-resolve",
        "IP-CIDR,149.154.160.0/20,Telegram,no-resolve",
        "IP-CIDR6,2001:67c:4e8::/48,Telegram,no-resolve",
        "IP-CIDR6,2001:b28:f23d::/48,Telegram,no-resolve",
        "IP-CIDR6,2001:b28:f23f::/48,Telegram,no-resolve",

        // Adobe
        "DOMAIN-SUFFIX,adobe.com,REJECT",
        "DOMAIN-SUFFIX,adobe.io,REJECT",
        "DOMAIN-SUFFIX,adobestats.io,REJECT",

        // 国内直连
        "DOMAIN-SUFFIX,acfun.tv,DIRECT",
        "DOMAIN-SUFFIX,aliapp.org,DIRECT",
        "DOMAIN-KEYWORD,alicdn,DIRECT",
        "DOMAIN-KEYWORD,alipay,DIRECT",
        "DOMAIN-SUFFIX,amap.com,DIRECT",
        "DOMAIN-SUFFIX,apple.com,DIRECT",
        "DOMAIN-KEYWORD,baidu,DIRECT",
        "DOMAIN-SUFFIX,baidu.com,DIRECT",
        "DOMAIN-SUFFIX,biligame.com,DIRECT",
        "DOMAIN-KEYWORD,bilibili,DIRECT",
        "DOMAIN-SUFFIX,bing.com,DIRECT",
        "DOMAIN-SUFFIX,douban.com,DIRECT",
        "DOMAIN-SUFFIX,douyin.com,DIRECT",
        "DOMAIN-SUFFIX,epubit.com,DIRECT",
        "DOMAIN-SUFFIX,jd.com,DIRECT",
        "DOMAIN-SUFFIX,kimi.com,DIRECT",
        "DOMAIN-SUFFIX,mi.com,DIRECT",
        "DOMAIN-SUFFIX,miui.com,DIRECT",
        "DOMAIN-SUFFIX,msn.com,DIRECT",
        "DOMAIN-SUFFIX,netease.com,DIRECT",
        "DOMAIN-SUFFIX,qq.com,DIRECT",
        "DOMAIN-SUFFIX,qianwen.com,DIRECT",
        "DOMAIN-SUFFIX,360.com,DIRECT",
        "DOMAIN-SUFFIX,sogou.com,DIRECT",
        "DOMAIN-SUFFIX,sohu.com,DIRECT",
        "DOMAIN-SUFFIX,taobao.com,DIRECT",
        "DOMAIN-SUFFIX,tencent.com,DIRECT",
        "DOMAIN-SUFFIX,tmall.com,DIRECT",
        "DOMAIN-SUFFIX,weibo.com,DIRECT",
        "DOMAIN-SUFFIX,weixin.com,DIRECT",
        "DOMAIN-SUFFIX,xunlei.com,DIRECT",
        "DOMAIN-SUFFIX,youdao.com,DIRECT",
        "DOMAIN-SUFFIX,youku.com,DIRECT",
        "DOMAIN-SUFFIX,zhihu.com,DIRECT",
        "DOMAIN-SUFFIX,126.com,DIRECT",
        "DOMAIN-SUFFIX,126.net,DIRECT",
        "DOMAIN-SUFFIX,127.net,DIRECT",
        "DOMAIN-SUFFIX,163.com,DIRECT",
        "DOMAIN-SUFFIX,deepseek.com,DIRECT",

        // 局域网 / 特殊地址
        "IP-CIDR,127.0.0.0/8,DIRECT",
        "IP-CIDR,192.168.0.0/16,DIRECT,no-resolve",
        "IP-CIDR,10.0.0.0/8,DIRECT,no-resolve",
        "IP-CIDR,172.16.0.0/12,DIRECT,no-resolve",
        "IP-CIDR,224.0.0.0/4,DIRECT,no-resolve",
        "IP-CIDR,100.64.0.0/10,DIRECT",
        "IP-CIDR6,::1/128,DIRECT,no-resolve",
        "IP-CIDR6,fc00::/7,DIRECT,no-resolve",
        "IP-CIDR6,fe80::/10,DIRECT,no-resolve",
        "DOMAIN-SUFFIX,local,DIRECT",
        "GEOIP,LAN,DIRECT,no-resolve",

        // 中国流量
        "DOMAIN-SUFFIX,cn,DIRECT",
        "GEOSITE,CN,DIRECT",
        "GEOIP,CN,DIRECT,no-resolve",
    ];
}

function addExternalNodes() {
    return [];
}

// main(config);