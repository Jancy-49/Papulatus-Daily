const fs = require('fs');
const path = require('path');

function extractData(htmlPath, outPath) {
    if (!fs.existsSync(htmlPath)) {
        console.log(`找不到文件: ${htmlPath}`);
        return;
    }

    const content = fs.readFileSync(htmlPath, 'utf8');
    const dataBlocks = content.split('<div class="data">').slice(1);

    const records = [];
    const keys = ['code', 'tag1', 'KMS', 'tag2', 'MSEA', 'tag3', 'GMS', 'tag4', 'JMS', 'tag5', 'TMS', 'tag6', 'CMS', 'tag7', 'MSN'];
    const seenCodes = new Set();

    dataBlocks.forEach(block => {
        const record = {};
        keys.forEach(key => {
            const regex = new RegExp(`<div class="${key}">(.*?)</div>`);
            const match = block.match(regex);
            if (match && match[1]) {
                record[key] = match[1].trim();
            }
        });

        if (Object.keys(record).length > 0) {
            if (record.code) {
                if (!seenCodes.has(record.code)) {
                    seenCodes.add(record.code);
                    records.push(record);
                }
            } else {
                // If there's no code field for some reason, we keep it just in case
                records.push(record);
            }
        }
    });

    fs.writeFileSync(outPath, "const tsData = " + JSON.stringify(records, null, 2) + ";\n", 'utf8');
    console.log(`JSON数据提取成功！共提取了 ${records.length} 条数据，已保存到 ${outPath}。`);

    // 接下来修改目标 HTML，将其替换为动态加载的模板
    console.log(`正在修改 HTML 文件，应用动态加载模板: ${htmlPath} ...`);

    // 注入或确保存在的 style (支持 search 和 container 的样式)
    const styleBlock = `
    <style>
        html, body { margin: 0; }
        #dataContainer { padding: 10px; }
        #dataContainer .data { width: auto; z-index: unset; }
        body > ul.banner { position: sticky; overflow: visible; top: 0; left: 0; z-index: 1000; }
        .search-container { padding: 20px; text-align: center; position: sticky; top: 48px; z-index: 998; background: #fff; }
    </style>
`;
    // 注入的新模板 (JS + HTML)
    const jsFileName = path.basename(outPath);
    const newTemplate = `
    <script src="${jsFileName}"></script>
    <div class="search-container">
        <input type="text" id="searchInput" placeholder="搜索名称或代码..."
            style="padding: 10px; width: 60%; max-width: 400px; font-size: 16px; border: 1px solid #ccc; border-radius: 4px;">
        <div>
            当前数据：<span id="total">0</span>条，请在输入框里搜索
        </div>
    </div>
    <div id="dataContainer"></div>

    <script>
        const container = document.getElementById('dataContainer');
        const searchInput = document.getElementById('searchInput');
        const total = document.getElementById('total');

        let currentData = [];
        let currentIndex = 0;
        const pageSize = 100;

        function createDataCard(item) {
            const div = document.createElement('div');
            div.className = 'data';
            div.innerHTML = \`
                <div class="code">\${item.code || ''}</div>
                <div class="tag1">KMS</div>
                <div class="KMS">\${item.KMS || ''}</div>
                <div class="tag2">MSEA</div>
                <div class="MSEA">\${item.MSEA || ''}</div>
                <div class="tag3">GMS</div>
                <div class="GMS">\${item.GMS || ''}</div>
                <div class="tag4">JMS</div>
                <div class="JMS">\${item.JMS || ''}</div>
                <div class="tag5">TMS</div>
                <div class="TMS">\${item.TMS || ''}</div>
                <div class="tag6">CMS</div>
                <div class="CMS">\${item.CMS || ''}</div>
                <div class="tag7">MSN</div>
                <div class="MSN">\${item.MSN || ''}</div>
            \`;
            return div;
        }

        function loadMoreData() {
            total.textContent = currentData.length;
            if (currentIndex >= currentData.length) return; // 没有更多数据

            const fragment = document.createDocumentFragment();
            const end = Math.min(currentIndex + pageSize, currentData.length);
            for (let i = currentIndex; i < end; i++) {
                fragment.appendChild(createDataCard(currentData[i]));
            }
            container.appendChild(fragment);
            currentIndex = end;
        }

        function renderData(dataToRender) {
            currentData = dataToRender;
            currentIndex = 0;
            container.innerHTML = '';

            if (currentData.length === 0) {
                const info = document.createElement('div');
                info.style.textAlign = 'center';
                info.style.margin = '20px';
                info.style.color = '#666';
                info.textContent = '没有找到匹配的结果 (No results found)';
                container.appendChild(info);
                return;
            }

            // 首次加载
            loadMoreData();
        }

        // 监听滚动到底部的事件，实现无限滚动
        window.addEventListener('scroll', () => {
            const documentHeight = document.body.offsetHeight;
            const scrollHeight = window.innerHeight + window.scrollY;

            // 距离底部 500px 时加载下一页
            if (scrollHeight >= documentHeight - 500) {
                loadMoreData();
            }
        });

        // 搜索防抖定时器
        let searchTimeout = null;

        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                const query = e.target.value.toLowerCase().trim();
                if (!query) {
                    renderData(tsData);
                    return;
                }

                const filtered = tsData.filter(item => {
                    return Object.values(item).some(val =>
                        val && val.toString().toLowerCase().includes(query)
                    );
                });
                renderData(filtered);
            }, 300); // 防抖 300ms
        });

        // Initialize with default data
        if (typeof tsData !== 'undefined') {
            renderData(tsData);
        } else {
            container.innerHTML = '<div style="text-align:center; padding: 20px;">未找到数据文件 (data.js)</div>';
        }
    </script>
`;

    let htmlContent = content;

    // 1. 如果还没有注入 style，则注入到 </head> 前
    if (!htmlContent.includes('.search-container {')) {
        htmlContent = htmlContent.replace('</head>', styleBlock + '</head>');
    }

    // 2. 清理硬编码的所有的 <div class="data">...</div> 并注入模板
    // 为了稳妥，找到第一个 <div class="data"> 和倒数最后一个 </div> (就在 <a class="back-to-top" 前面)
    const firstDataIndex = htmlContent.indexOf('<div class="data">');
    if (firstDataIndex !== -1) {
        // 由于这部分可能很长，或者已经被修改过了
        // 这里定位到 </body> 前面的那部分 back-to-top 链接
        const backToTopIndex = htmlContent.indexOf('<a href="javascript:void(0);"');
        if (backToTopIndex !== -1) {
            // 我们只需要把从 firstDataIndex 到 backToTopIndex 中间的内容替换
            const beforeData = htmlContent.substring(0, firstDataIndex);
            const afterData = htmlContent.substring(backToTopIndex);
            htmlContent = beforeData + newTemplate + '\n    ' + afterData;
        }
    }

    fs.writeFileSync(htmlPath, htmlContent, 'utf8');
    console.log(`HTML 文件 ${htmlPath} 已成功更新为动态搜索加载模式！\n`);
}

const args = process.argv.slice(2);

if (args.length < 2) {
    console.log("用法: node migrate.js <输入文件.html> <输出文件.js>");
    console.log("示例: node migrate.js Map.html MapData.js");
    process.exit(1);
}

const inputPath = args[0];
const outputPath = args[1];

extractData(inputPath, outputPath);
