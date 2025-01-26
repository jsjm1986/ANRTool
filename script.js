class NovelRewriter {
    constructor() {
        this.originalText = '';
        this.apiKey = '';
        this.chapters = [];
        this.currentChapter = 0;
        this.generatedContent = [];
        this.foreshadowings = new Map(); // 存储识别到的伏笔
        this.zoomLevel = 100;
        this.viewMode = 'split'; // split 或 single
        this.init();
    }

    init() {
        // 检查本地存储中是否有有效的 API key
        const savedApiKey = localStorage.getItem('deepseekApiKey');
        if (savedApiKey) {
            this.validateAndInitialize(savedApiKey);
        } else {
            this.showLoginPage();
        }
    }

    showLoginPage() {
        document.getElementById('loginPage').style.display = 'flex';
        document.getElementById('appPage').style.display = 'none';
        document.getElementById('loginBtn').addEventListener('click', () => this.handleLogin());
    }

    showAppPage() {
        document.getElementById('loginPage').style.display = 'none';
        document.getElementById('appPage').style.display = 'block';
        this.initializeUI();
    }

    initializeUI() {
        // 绑定UI控件事件
        const parametersPanel = document.querySelector('.parameters');
        parametersPanel.classList.add('open'); // 默认展开
        
        document.getElementById('toggleParams').addEventListener('click', () => {
            parametersPanel.classList.toggle('open');
            const button = document.getElementById('toggleParams');
            if (parametersPanel.classList.contains('open')) {
                button.innerHTML = '<i class="fas fa-chevron-up"></i> 收起参数';
            } else {
                button.innerHTML = '<i class="fas fa-chevron-down"></i> 展开参数';
            }
        });

        document.getElementById('viewMode').addEventListener('click', () => {
            this.toggleViewMode();
        });

        document.getElementById('zoomIn').addEventListener('click', () => {
            this.changeZoom(10);
        });

        document.getElementById('zoomOut').addEventListener('click', () => {
            this.changeZoom(-10);
        });

        document.getElementById('saveBtn').addEventListener('click', () => {
            this.saveProgress();
        });

        document.getElementById('exportBtn').addEventListener('click', () => {
            this.exportResult();
        });

        // 添加滑块值显示更新
        const sliders = [
            'plotChange', 'characterChange', 'complexity', 'detailLevel', 
            'dialogueRatio', 'emotionalIntensity', 'foreshadowingSensitivity', 
            'foreshadowingIntensity'
        ];
        sliders.forEach(id => {
            const slider = document.getElementById(id);
            const valueDisplay = document.getElementById(`${id}Value`);
            slider.addEventListener('input', () => {
                valueDisplay.textContent = `${slider.value}%`;
            });
        });

        // 绑定文件上传和生成按钮
        document.getElementById('fileInput').addEventListener('change', this.handleFileUpload.bind(this));
        document.getElementById('generateBtn').addEventListener('click', this.generateNovel.bind(this));

        // 自动保存功能
        document.getElementById('autoSave').addEventListener('change', (e) => {
            if (e.target.checked) {
                this.startAutoSave();
            } else {
                this.stopAutoSave();
            }
        });
    }

    async handleLogin() {
        const apiKey = document.getElementById('apiKey').value.trim();
        if (!apiKey) {
            this.showLoginError('请输入 API 密钥');
            return;
        }

        try {
            await this.validateAndInitialize(apiKey);
        } catch (error) {
            this.showLoginError('API 密钥验证失败，请检查后重试');
        }
    }

    showLoginError(message) {
        const errorElement = document.getElementById('loginError');
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }

    async validateAndInitialize(apiKey) {
        try {
            const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: "deepseek-chat",
                    messages: [{
                        role: "user",
                        content: "测试消息"
                    }],
                    max_tokens: 10
                })
            });

            if (response.ok) {
                this.apiKey = apiKey;
                localStorage.setItem('deepseekApiKey', apiKey);
                this.showAppPage();
            } else {
                throw new Error('API key 无效');
            }
        } catch (error) {
            throw new Error('API key 验证失败');
        }
    }

    toggleViewMode() {
        const container = document.querySelector('.result-container');
        this.viewMode = this.viewMode === 'split' ? 'single' : 'split';
        container.className = `result-container ${this.viewMode}-view`;
        document.getElementById('viewMode').innerHTML = 
            this.viewMode === 'split' ? '<i class="fas fa-columns"></i>' : '<i class="fas fa-square"></i>';
    }

    changeZoom(delta) {
        this.zoomLevel = Math.max(50, Math.min(200, this.zoomLevel + delta));
        document.getElementById('zoomLevel').textContent = `${this.zoomLevel}%`;
        document.querySelectorAll('.content-box').forEach(box => {
            box.style.fontSize = `${this.zoomLevel}%`;
        });
    }

    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const text = await this.readFile(file);
            this.originalText = text;
            this.chapters = this.splitIntoChapters(text);
            this.displayChapters();
            this.showNotification('文件上传成功');
        } catch (error) {
            console.error('文件读取错误:', error);
            this.showNotification('文件读取失败，请重试', 'error');
        }
    }

    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
        });
    }

    splitIntoChapters(text) {
        // 根据章节标记分割文本
        const chapterRegex = /第[零一二三四五六七八九十百千万\d]+章/g;
        let chapters = text.split(chapterRegex);
        chapters = chapters.filter(chapter => chapter.trim().length > 0);
        
        // 保存章节标题
        const titles = text.match(chapterRegex) || [];
        
        return chapters.map((content, index) => ({
            title: titles[index] || `第${index + 1}章`,
            content: content.trim(),
            generated: false
        }));
    }

    displayChapters() {
        const container = document.getElementById('chapterListContainer');
        container.innerHTML = this.chapters.map((chapter, index) => `
            <div class="chapter-item ${index === this.currentChapter ? 'active' : ''}"
                 data-index="${index}">
                <span class="chapter-title">${chapter.title}</span>
                <span class="chapter-status">
                    ${chapter.generated ? '<i class="fas fa-check"></i>' : ''}
                </span>
            </div>
        `).join('');

        // 添加章节点击事件
        container.querySelectorAll('.chapter-item').forEach(item => {
            item.addEventListener('click', () => {
                this.currentChapter = parseInt(item.dataset.index);
                this.displayChapters();
                this.displayContent();
            });
        });

        this.displayContent();
    }

    displayContent() {
        const originalContent = document.getElementById('originalContent');
        const generatedContent = document.getElementById('generatedContent');

        if (this.chapters[this.currentChapter]) {
            originalContent.textContent = this.chapters[this.currentChapter].content;
            generatedContent.textContent = this.generatedContent[this.currentChapter] || '等待生成...';
        }
    }

    async generateNovel() {
        if (this.chapters.length === 0) {
            this.showNotification('请先上传小说文件', 'error');
            return;
        }

        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'loading-overlay';
        loadingIndicator.innerHTML = `
            <div class="loading-content">
                <div class="loading-spinner"></div>
                <div class="progress-container">
                    <div id="progressBar" class="progress-bar">0%</div>
                </div>
                <p class="loading-text">正在生成中，请稍候...</p>
                <div class="current-task">
                    <span id="currentTaskText">正在处理：第1章</span>
                </div>
            </div>
        `;
        document.body.appendChild(loadingIndicator);

        try {
            for (let i = 0; i < this.chapters.length; i++) {
                if (!this.chapters[i].generated) {
                    // 先识别伏笔
                    await this.identifyForeshadowings(i, this.chapters[i].content);

                    document.getElementById('currentTaskText').textContent = `正在处理：${this.chapters[i].title}`;
                    const context = this.getContext(i);
                    const params = this.getCurrentParameters();
                    
                    // 调用AI进行改写
                    const generatedText = await this.callAIAPI({
                        context,
                        text: this.chapters[i].content,
                        params
                    });

                    this.chapters[i].generated = true;
                    this.generatedContent[i] = generatedText;

                    // 更新进度
                    const progress = ((i + 1) / this.chapters.length) * 100;
                    document.getElementById('progressBar').style.width = `${progress}%`;
                    document.getElementById('progressBar').textContent = `${Math.round(progress)}%`;

                    // 实时显示生成的内容
                    if (i === this.currentChapter) {
                        this.displayContent();
                    }
                    this.displayChapters();

                    // 自动保存
                    if (document.getElementById('autoSave')?.checked) {
                        this.saveProgress();
                    }
                }
            }
            this.showNotification('生成完成');
        } catch (error) {
            console.error('生成失败:', error);
            this.showNotification(`生成失败: ${error.message}`, 'error');
        } finally {
            document.body.removeChild(loadingIndicator);
        }
    }

    async identifyForeshadowings(text) {
        const API_ENDPOINT = 'https://api.deepseek.com/v1/chat/completions';

        const prompt = `作为一个专业的小说分析系统，请分析以下文本中的伏笔。

[分析要求]
1. 识别文本中可能的伏笔元素
2. 分析每个伏笔的类型和作用
3. 提供简短的说明

[输出格式]
请以JSON格式输出，格式如下：
{
    "foreshadowings": [
        {
            "type": "伏笔类型",
            "content": "具体内容",
            "description": "简短说明"
        }
    ]
}

[待分析文本]
${text}

请直接输出JSON格式的分析结果，不要包含其他说明文字。`;

        try {
            const response = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: "deepseek-chat",
                    messages: [
                        {
                            role: "system",
                            content: "你是一个专业的小说分析系统，专门用于识别和分析文本中的伏笔。请只输出JSON格式的分析结果。"
                        },
                        {
                            role: "user",
                            content: prompt
                        }
                    ],
                    temperature: 0.3,
                    max_tokens: 1000,
                    response_format: { type: "json_object" }
                })
            });

            if (!response.ok) {
                throw new Error('API请求失败');
            }

            const data = await response.json();
            const result = data.choices[0].message.content;

            // 清理和验证JSON字符串
            const cleanedResult = result.trim()
                .replace(/^```json\s*/, '')  // 移除开头的 ```json
                .replace(/```\s*$/, '')      // 移除结尾的 ```
                .replace(/\n/g, ' ')         // 移除换行符
                .trim();

            try {
                const parsedResult = JSON.parse(cleanedResult);
                return parsedResult.foreshadowings || [];
            } catch (parseError) {
                console.error('JSON解析错误:', parseError);
                console.error('清理后的结果:', cleanedResult);
                return [];
            }

        } catch (error) {
            console.error('伏笔识别失败:', error);
            return [];
        }
    }

    displayForeshadowings() {
        const container = document.getElementById('foreshadowingList');
        let html = '';

        this.foreshadowings.forEach((foreshadowings, chapterIndex) => {
            html += `<div class="chapter-foreshadowings">
                <h6>第${chapterIndex + 1}章</h6>`;
            
            foreshadowings.forEach(item => {
                html += `<div class="foreshadowing-item">
                    <span class="type">${item.type}</span>
                    <span class="content">${item.content}</span>
                    <div class="description">${item.description}</div>
                </div>`;
            });

            html += '</div>';
        });

        container.innerHTML = html;
    }

    getContext(currentIndex) {
        const prevChapter = currentIndex > 0 ? this.generatedContent[currentIndex - 1] : null;
        const previousForeshadowings = Array.from(this.foreshadowings.entries())
            .filter(([index]) => index < currentIndex)
            .map(([_, items]) => items)
            .flat();

        return {
            previousChapter: prevChapter,
            chapterTitle: this.chapters[currentIndex].title,
            totalChapters: this.chapters.length,
            currentChapter: currentIndex + 1,
            foreshadowings: previousForeshadowings
        };
    }

    async callAIAPI(params) {
        if (params.context.specialTask === 'foreshadowing-identification') {
            // 处理伏笔识别的特殊请求
            const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: "deepseek-chat",
                    messages: [{
                        role: "user",
                        content: params.text
                    }],
                    temperature: 0.3,
                    max_tokens: 1000
                })
            });

            if (!response.ok) throw new Error(`API 请求失败: ${response.status}`);
            const data = await response.json();
            return data.choices[0].message.content;
        }

        const API_ENDPOINT = 'https://api.deepseek.com/v1/chat/completions';
        const currentParams = this.getCurrentParameters();

        let prompt = `你是一位专业的小说改编大师。现在请根据以下创作参数改写《${params.context.chapterTitle}》（总${params.context.totalChapters}章的第${params.context.currentChapter}章）。

[名称替换映射表]
${Object.entries(params.nameReplacements || {}).map(([old, new_]) => 
    `${old} => ${new_}`
).join('\n')}

[创作要求]
1. 严格按照名称替换映射表替换相关名称
2. 保持替换后名称的一致性和连贯性
3. 确保替换后的名称自然融入故事
4. 维持人物关系和情节的清晰度
5. 注意新名称与故事背景的协调性

[上下文信息]
${params.context.previousChapter ? '上一章内容：' + params.context.previousChapter.substring(0, 200) + '...' : '这是第一章'}

[伏笔信息]
${params.context.foreshadowings.length > 0 ? 
    params.context.foreshadowings.map(f => 
        `- ${f.content}（${f.description}）`
    ).join('\n')
    : '本章无需呼应的伏笔'}

[原文内容]
${params.text}

[系统指令]
你现在将扮演一个专业的小说改编系统，使用提供的参数对原文进行改写。请注意：
1. 严格遵循名称替换映射表
2. 保持故事的流畅性和自然性
3. 确保改写后的内容符合所有参数要求
4. 维护故事的整体连贯性
5. 注意新名称与情节的融合

请直接开始改写，无需解释参数或创作思路。输出格式要求：
1. 直接输出改写后的内容
2. 不要包含任何参数说明或创作说明
3. 不要使用分段符号或章节标记
4. 保持文本的连贯性和可读性

开始改写：`;

        try {
            const response = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: "deepseek-chat",
                    messages: [
                        {
                            role: "system",
                            content: "你是一个专业的小说改编专家，擅长根据具体参数要求对小说进行精确的改写。请严格按照名称替换映射表进行改写，确保替换的一致性和自然性。"
                        },
                        {
                            role: "user",
                            content: prompt
                        }
                    ],
                    temperature: 0.7,
                    max_tokens: 2000,
                    top_p: 0.95,
                    frequency_penalty: 0.1,
                    presence_penalty: 0.1
                })
            });

            if (!response.ok) {
                throw new Error(`API 请求失败: ${response.status}`);
            }

            const data = await response.json();
            return data.choices[0].message.content;
        } catch (error) {
            console.error('API 调用错误:', error);
            throw new Error('生成失败，请检查 API 配置或重试');
        }
    }

    getStyleDescription(style) {
        const styleMap = {
            'modern': '现代派写作风格，使用简洁明快的语言，突出现代生活特征',
            'classic': '古典派写作风格，运用优美典雅的语言，体现传统文学特色',
            'humor': '幽默风格，通过诙谐有趣的语言和情节设置，突出故事的娱乐性',
            'suspense': '悬疑风格，营造神秘氛围，设置悬念，保持故事张力',
            'romantic': '言情风格，着重描写感情戏，细腻刻画人物情感变化'
        };
        return styleMap[style] || style;
    }

    getEmotionalToneDescription(tone) {
        const toneMap = {
            'neutral': '保持中性的叙事语气，不过分渲染情感',
            'positive': '整体基调积极向上，突出温暖、希望等正面情感',
            'negative': '营造深沉压抑的氛围，着重描写矛盾与困境',
            'dramatic': '强调戏剧性效果，突出情节转折与情感冲突'
        };
        return toneMap[tone] || tone;
    }

    async saveProgress() {
        try {
            const data = {
                chapters: this.chapters,
                generatedContent: this.generatedContent,
                foreshadowings: Array.from(this.foreshadowings.entries()),
                parameters: this.getCurrentParameters()
            };
            localStorage.setItem('novelRewriterProgress', JSON.stringify(data));
            this.showNotification('进度已保存');
        } catch (error) {
            this.showNotification('保存失败', 'error');
        }
    }

    async exportResult() {
        const content = this.generatedContent.join('\n\n');
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = '复刻结果.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    getCurrentParameters() {
        const params = {
            // 基础设置
            style: document.getElementById('style').value,
            plotChange: document.getElementById('plotChange').value,
            characterChange: document.getElementById('characterChange').value,
            
            // 语言风格
            complexity: document.getElementById('complexity').value,
            detailLevel: document.getElementById('detailLevel').value,
            dialogueRatio: document.getElementById('dialogueRatio').value,
            
            // 情感设置
            emotionalTone: document.getElementById('emotionalTone').value,
            emotionalIntensity: document.getElementById('emotionalIntensity').value,
            
            // 伏笔设置
            foreshadowingSensitivity: document.getElementById('foreshadowingSensitivity').value,
            foreshadowingIntensity: document.getElementById('foreshadowingIntensity').value,
            foreshadowingTypes: Array.from(document.getElementById('foreshadowingType').selectedOptions).map(opt => opt.value),

            // 世界观设置
            worldSetting: document.getElementById('worldSetting').value,
            timelineChange: document.getElementById('timelineChange').value,
            culturalChange: document.getElementById('culturalChange').value,

            // 人物塑造
            protagonistAdjustment: Array.from(document.getElementById('protagonistAdjustment').selectedOptions).map(opt => opt.value),
            supportingRole: document.getElementById('supportingRole').value,
            relationshipComplexity: document.getElementById('relationshipComplexity').value,

            // 叙事结构
            narrativePerspective: document.getElementById('narrativePerspective').value,
            timelineStructure: document.getElementById('timelineStructure').value,
            suspenseIntensity: document.getElementById('suspenseIntensity').value,

            // 主题深化
            coreThemes: Array.from(document.getElementById('coreThemes').selectedOptions).map(opt => opt.value),
            themeExpression: document.getElementById('themeExpression').value,
            philosophicalDepth: document.getElementById('philosophicalDepth').value,

            // 场景描写
            environmentalDetail: document.getElementById('environmentalDetail').value,
            atmosphereIntensity: document.getElementById('atmosphereIntensity').value,
            sceneInteraction: document.getElementById('sceneInteraction').value,

            // 文学技巧
            literaryDevices: Array.from(document.getElementById('literaryDevices').selectedOptions).map(opt => opt.value),
            imageryIntensity: document.getElementById('imageryIntensity').value,
            languageStyle: document.getElementById('languageStyle').value,

            // 智能替换设置
            replacementLevel: document.getElementById('replacementLevel').value,
            replacementTypes: Array.from(document.getElementById('replacementTypes').selectedOptions).map(opt => opt.value),
            replacementStyle: document.getElementById('replacementStyle').value,
            culturalStyle: document.getElementById('culturalStyle').value,
            consistencyLevel: document.getElementById('consistencyLevel').value
        };
        return params;
    }

    startAutoSave() {
        this.autoSaveInterval = setInterval(() => {
            this.saveProgress();
        }, 5 * 60 * 1000); // 每5分钟自动保存一次
    }

    stopAutoSave() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }
    }

    // 新增的辅助方法
    getWorldSettingDescription(setting) {
        const settingMap = {
            'keep': '保持原有世界观设定',
            'modern': '现代都市背景，突出现代生活特征',
            'ancient': '古代历史背景，注重历史细节还原',
            'fantasy': '奇幻世界背景，构建独特的魔法体系',
            'future': '未来科技背景，展现科技发展愿景',
            'steampunk': '蒸汽朋克风格，融合复古与科技元素'
        };
        return settingMap[setting] || setting;
    }

    getNarrativePerspectiveDescription(perspective) {
        const perspectiveMap = {
            'keep': '保持原有叙事视角',
            'first': '第一人称视角，深入角色内心',
            'third-limited': '第三人称限制性视角，聚焦特定角色',
            'third-omniscient': '第三人称全知视角，全面展现故事',
            'multiple': '多视角叙事，展现不同角度'
        };
        return perspectiveMap[perspective] || perspective;
    }

    getTimelineStructureDescription(structure) {
        const structureMap = {
            'linear': '线性叙事，按时间顺序展开',
            'nonlinear': '非线性叙事，打破时间顺序',
            'parallel': '平行时间线，展现多条故事线',
            'flashback': '闪回结构，穿插过去与现在'
        };
        return structureMap[structure] || structure;
    }

    getThemeExpressionDescription(expression) {
        const expressionMap = {
            'explicit': '直接表达主题思想',
            'implicit': '含蓄暗示主题内涵',
            'symbolic': '通过象征手法传达主题',
            'mixed': '综合运用多种表达方式'
        };
        return expressionMap[expression] || expression;
    }

    getLanguageStyleDescription(style) {
        const styleMap = {
            'simple': '简洁明快的语言风格',
            'elegant': '优美典雅的语言风格',
            'poetic': '富有诗意的语言风格',
            'colloquial': '生动的口语化表达',
            'mixed': '灵活混合多种语言风格'
        };
        return styleMap[style] || style;
    }

    // 添加名称替换相关的处理方法
    async generateNameReplacements(text, params) {
        const API_ENDPOINT = 'https://api.deepseek.com/v1/chat/completions';

        const prompt = `作为一个专业的小说改编系统，请对以下文本中的名称进行智能替换。

[替换要求]
1. 替换程度：${params.replacementLevel}%
2. 替换类型：${params.replacementTypes.join('、')}
3. 替换风格：${this.getReplacementStyleDescription(params.replacementStyle)}
4. 文化倾向：${this.getCulturalStyleDescription(params.culturalStyle)}
5. 一致性要求：${params.consistencyLevel}%

[替换原则]
1. 保持名称的文化和语言特点一致性
2. 确保替换后的名称符合故事背景
3. 维护人物关系的清晰度
4. 避免使用知名作品中的名称
5. 确保替换后的名称易于记忆和辨识

[输出格式]
请以JSON格式输出替换映射表：
{
    "replacements": {
        "原名称1": "新名称1",
        "原名称2": "新名称2"
    }
}

[待处理文本]
${text}

请直接输出JSON格式的替换映射表，不要包含其他说明文字。`;

        try {
            const response = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: "deepseek-chat",
                    messages: [
                        {
                            role: "system",
                            content: "你是一个专业的名称替换系统，专门用于生成符合特定要求的替换名称。请只输出JSON格式的替换映射表。"
                        },
                        {
                            role: "user",
                            content: prompt
                        }
                    ],
                    temperature: 0.7,
                    max_tokens: 1000,
                    response_format: { type: "json_object" }
                })
            });

            if (!response.ok) {
                throw new Error('API请求失败');
            }

            const data = await response.json();
            const result = data.choices[0].message.content;

            // 清理和验证JSON字符串
            const cleanedResult = result.trim()
                .replace(/^```json\s*/, '')
                .replace(/```\s*$/, '')
                .replace(/\n/g, ' ')
                .trim();

            try {
                const parsedResult = JSON.parse(cleanedResult);
                return parsedResult.replacements || {};
            } catch (parseError) {
                console.error('JSON解析错误:', parseError);
                return {};
            }
        } catch (error) {
            console.error('名称替换生成失败:', error);
            return {};
        }
    }

    // 替换风格描述
    getReplacementStyleDescription(style) {
        const styleMap = {
            'similar': '保持与原名称相似的风格特点',
            'contrast': '使用与原名称形成鲜明对比的风格',
            'neutral': '使用中性且普遍的命名风格',
            'creative': '使用富有创意和特色的命名方式'
        };
        return styleMap[style] || style;
    }

    // 文化风格描述
    getCulturalStyleDescription(style) {
        const styleMap = {
            'keep': '保持原有的文化特点',
            'chinese': '使用具有中国文化特色的命名',
            'western': '使用西方文化风格的命名',
            'japanese': '使用日本文化特色的命名',
            'korean': '使用韩国文化特色的命名',
            'mixed': '混合多种文化特色的命名'
        };
        return styleMap[style] || style;
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new NovelRewriter();
}); 