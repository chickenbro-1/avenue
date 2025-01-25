// ==UserScript==
// @name         D2L Quiz Scraper
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  抓取 D2L Quiz 中的选择题题目与选项，并在获取答案后自动填写
// @author       GrumpyCat
// @match        https://avenue.cllmcmaster.ca/d2l/lms/quizzing/user/attempt/*
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// ==/UserScript==

(function () {
    'use strict';
    let controlPanelInitialized = false;

    window.addEventListener('load', () => {
        if (document.readyState === 'complete') {
            initControlPanel();
        }
        // 1. 获取本地的 quizData（题目+选项+选项对应的<input> ID等）
        const quizData = parseQuizData();
        if (quizData.length === 0) {
            console.log('未找到任何题目');
            return;
        }
        console.log('抓取到的 quizData: ', quizData);

        // 构造要 POST 的请求体
        const requestData = {
            questions_data: quizData
        };

        // 2. 发送请求到后端，后端返回题号 + 正确选项
        postQuizData(requestData)
            .then((res) => {
                // res 为后端返回的答案数组，如:
                // [ { "id": 1, "answer": "A" }, { "id": 2, "answer": "C" }, ... ]
                console.log('后端返回的数据:', res);

                // 3. 自动选择对应的选项
                autoSelectAnswers(res, quizData);
            })
            .catch((error) => {
                console.error('请求出错:', error);
            });
    });


    /**
 * 初始化控制面板和图标
 * 在脚本最后或合适位置插入此函数，并在 window.load 回调中调用它
 */
    function initControlPanel() {
        if (controlPanelInitialized || document.getElementById('myScript-controlContainer')) {
            return; // 已经初始化过，直接返回
        }
        controlPanelInitialized = true;
        // 1. 注入样式(可自定义)
        const style = document.createElement('style');
        style.textContent = `
        /* 容器：固定位置，右下角示例 */
        #myScript-controlContainer {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 9999; /* 保证显示在最前 */
            font-family: sans-serif;
        }
        /* 图标按钮：可根据需要换成自己的 icon */
        #myScript-toggleIcon {
            width: 40px;
            height: 40px;
            background-color: #007bff;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
            font-weight: bold;
            box-shadow: 0 0 5px rgba(0,0,0,0.3);
        }
        #myScript-toggleIcon:hover {
            background-color: #0056b3;
        }
        /* 控制面板：默认隐藏，可放置内部内容 */
        #myScript-panel {
            margin-top: 8px;
            background-color: #f8f9fa;
            padding: 12px;
            border: 1px solid #ccc;
            border-radius: 4px;
            display: none; /* 默认不显示 */
            min-width: 220px;
        }
    `;
        document.head.appendChild(style);

        // 2. 创建容器
        const container = document.createElement('div');
        container.id = 'myScript-controlContainer';

        // 3. 创建“图标”元素
        const toggleIcon = document.createElement('div');
        toggleIcon.id = 'myScript-toggleIcon';

        // 4. 创建“控制面板”
        const panel = document.createElement('div');
        panel.id = 'myScript-panel';
        panel.innerHTML = `
        <div style="margin-bottom:8px;">这里是控制面板内容</div>
        <!-- 你可以在这里添加按钮、文字、状态信息等 -->
        <!-- <button id="myScript-manualFetchBtn">手动获取题目</button> -->
    `;

        // 5. 图标点击事件：切换面板的显示/隐藏
        toggleIcon.addEventListener('click', () => {
            if (panel.style.display === 'none') {
                panel.style.display = 'block';
            } else {
                panel.style.display = 'none';
            }
        });

        // 6. 将图标和面板一起放入容器，再放进页面
        container.appendChild(toggleIcon);
        container.appendChild(panel);
        document.body.appendChild(container);
    }

    /**
     * 解析页面中的题目与选项数据
     * 关键：为每个选项保存对应的 inputId (或元素引用)，后续可直接进行点击
     * @returns {Array} 数组，每个元素形如:
     *   { id, questionText, answers: [ {index, text, inputId}, ... ] }
     */
    function parseQuizData() {
        // 这里仅示例逻辑，可能需要根据实际页面的结构微调选择器
        const questionDivs = document.querySelectorAll('div.dco');
        const quizData = [];
        let id = 1;  // 题号，自己决定是否和后端一一对应

        questionDivs.forEach((questionDiv) => {
            // 找到题干所在区
            const questionContainer = questionDiv.nextElementSibling;
            if (!questionContainer) return;

            const questionTextBlock = questionContainer.querySelector('d2l-html-block[html]');
            // 题干文本
            const questionText = questionTextBlock
                ? decodeHtml(questionTextBlock.getAttribute('html'))
                : '';

            // 获取当前题的所有选项行 <tr>
            const answerRows = questionContainer.querySelectorAll('fieldset table tbody tr');
            const answers = [];
            let index = 1;

            answerRows.forEach((row) => {
                // 获取选项文本
                const answerBlock = row.querySelector('div.d2l-htmlblock-untrusted d2l-html-block');
                const answerText = answerBlock
                    ? decodeHtml(answerBlock.getAttribute('html'))
                    : '';

                // 选项对应的 <input type="radio"> ID
                const radioInput = row.querySelector('input[type="radio"]');
                const inputId = radioInput ? radioInput.id : null;

                answers.push({
                    index: index++,          // 第几个选项(A=1, B=2, C=3, ...)
                    text: answerText,
                    inputId: inputId         // 记录下来
                });
            });

            if (questionText) {
                quizData.push({
                    id: id++,
                    questionText,
                    answers
                });
            }
        });

        return quizData;
    }

    /**
     * 当后端返回答案后，根据答案自动点选对应选项
     * @param {Array} serverAnswers 后端返回的答案数组，如 [ {id:1, answer:'A'}, ... ]
     * @param {Array} quizData 本地页面解析的题目/选项数据
     */
    function autoSelectAnswers(serverAnswers, quizData) {
        // 简单的 "A" -> 1, "B" -> 2, ...
        const letterToIndex = (letter) => letter.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0) + 1;

        serverAnswers.forEach(({ id, answer }) => {
            const questionObj = quizData.find(q => q.id === id);
            if (!questionObj) {
                console.warn(`找不到题号id=${id}对应的题目`);
                return;
            }
            const ansIndex = letterToIndex(answer);  // "A" -> 1
            const targetAns = questionObj.answers.find(a => a.index === ansIndex);
            if (!targetAns) {
                console.warn(`题${id}中找不到对应选项:${answer}`);
                return;
            }
            const inputEl = document.getElementById(targetAns.inputId);
            if (inputEl) {
                // 触发点击（或 inputEl.checked = true）
                inputEl.click();
            } else {
                console.warn(`找不到对应radio: #${targetAns.inputId}，无法自动点选`);
            }
        });
    }

    /**
     * 使用 GM_xmlhttpRequest 发起 POST 请求
     * @param {Object} quizData 要上传的 JSON 数据
     * @returns {Promise} 返回 Promise，resolve 时返回后端数据
     */
    function postQuizData(quizData) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'POST',
                url: 'https://techflowlab.xyz/api/answer-questions/',
                headers: {
                    'Content-Type': 'application/json'
                },
                data: JSON.stringify(quizData),
                onload: function (response) {
                    try {
                        const data = JSON.parse(response.responseText);
                        console.log('上传成功, 后端响应:', data);
                        resolve(data);
                    } catch (err) {
                        console.error('JSON 解析错误:', err);
                        reject(err);
                    }
                },
                onerror: function (error) {
                    console.error('上传出错:', error);
                    reject(error);
                },
                ontimeout: function () {
                    console.error('请求超时');
                    reject(new Error('请求超时'));
                },
                onabort: function () {
                    console.error('请求被中断');
                    reject(new Error('请求被中断'));
                }
            });
        });
    }

    // 将 HTML 字符转换为纯文本
    function decodeHtml(html) {
        const txt = document.createElement('textarea');
        txt.innerHTML = html;
        return txt.value;
    }

})();
