const fs = require('fs');
const path = require('path');

function deduplicateFile(filePath) {
    if (!fs.existsSync(filePath)) {
        console.error(`文件不存在: ${filePath}`);
        return;
    }
    
    console.log(`===============================================`);
    console.log(`开始处理: ${path.basename(filePath)}`);
    console.log(`正在读取文件加载到内存...`);
    const content = fs.readFileSync(filePath, 'utf8');
    
    // 寻找数组的起始和结束位置，保留原本的变量声明（例如 const mobData = ）
    const startIndex = content.indexOf('[');
    const endIndex = content.lastIndexOf(']');
    
    if (startIndex === -1 || endIndex === -1) {
        console.error(`无法在文件中找到数据数组: ${filePath}`);
        return;
    }

    // 提取前缀（例如：const mobData = ）和后缀（例如：;）
    const prefix = content.substring(0, startIndex);
    const suffix = content.substring(endIndex + 1);
    
    // 提取数组部分
    const jsonString = content.substring(startIndex, endIndex + 1);
    
    console.log(`正在解析数据结构...`);
    let data;
    try {
        // 第一顺位：尝试用标准 JSON 解析（速度最快）
        data = JSON.parse(jsonString);
    } catch (e) {
        console.log(`标准 JSON 解析失败，因文件可能包含 JS 不严谨语法。尝试回退以纯 JS 对象计算...`);
        try {
            data = new Function(`return ${jsonString}`)();
        } catch (err) {
            console.error(`解析数据失败，格式错误:`, err.message);
            return;
        }
    }

    if (!Array.isArray(data)) {
        console.error(`从文件中提取的数据不是一个数组`);
        return;
    }

    console.log(`正在基于 code 字段去重执行中...`);
    const uniqueData = [];
    const seen = new Set();
    
    for (const item of data) {
        if (item && item.code !== undefined) {
            // 利用 Set 的 O(1) 查找特性进行高效率去重去重
            if (!seen.has(item.code)) {
                seen.add(item.code);
                uniqueData.push(item);
            }
        } else {
            // 如果没有 code 字段的项，为了安全起见默认予以保留
            uniqueData.push(item);
        }
    }

    console.log(`✅ 原始总数量: ${data.length} 条`);
    console.log(`✅ 去重后数量: ${uniqueData.length} 条`);

    if (data.length === uniqueData.length) {
        console.log(`无需改动，没有发现重复项。\n`);
        return;
    }

    console.log(`正在将去重后的数据序列化并写回到文件...`);
    // 组装回原本的文件格式（带有原本的前缀和后缀）
    // JSON.stringify(uniqueData, null, 2) 格式化双空格更利于阅读
    const outputContent = `${prefix}${JSON.stringify(uniqueData, null, 2)}${suffix}`;
    fs.writeFileSync(filePath, outputContent, 'utf8');
    console.log(`写入成功！已覆盖原始文件。\n`);
}

// 目标文件路径
const mapDataPath = path.join(__dirname, 'MapData.js');
const mobDataPath = path.join(__dirname, 'MobData.js');

// 执行去重
deduplicateFile(mapDataPath);
deduplicateFile(mobDataPath);

console.log(`===============================================`);
console.log("所有数据去重处理已顺利完成！");
