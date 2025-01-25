// ==UserScript==
// @name         D2L Quiz Scraper
// @namespace    http://tampermonkey.net/
// @version      0.8
// @description  抓取 D2L Quiz 中的选择题题目与选项
// @author       GrumpyCat
// @match        https://avenue.cllmcmaster.ca/d2l/lms/quizzing/user/attempt/*
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// ==/UserScript==

(function () {
    'use strict';

    // 页面加载或 DOM 更新后执行
    window.addEventListener('load', () => {
        const quizData = parseQuizData();
        if (quizData.length !== 0) {
            console.log('抓取结果: ', quizData);

            // 请求方式post JSON格式
            const requestData = {
                questions_data: quizData
            };

            postQuizData(requestData)
                .then((res) => {
                    // res 就是后端返回的 JSON 数据
                    console.log('后端返回的数据:', res);
                })
                .catch((error) => {
                    console.error('请求出错:', error);
                });
        }
    });

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
                        // 解析后端返回的 JSON 数据
                        const data = JSON.parse(response.responseText);
                        console.log('上传成功:', data);
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

    /**
     * 解析页面中的题目与选项数据
     * @returns {Array} 数组，每个元素是 { id, questionText, answers } 这样的对象
     */
    function parseQuizData() {
        // 找到所有题目的容器
        const questionDivs = document.querySelectorAll('div.dco');
        const quizData = [];
        let id = 1;

        questionDivs.forEach((questionDiv) => {
            const questionContainer = questionDiv.nextElementSibling;
            if (!questionContainer) return;

            // 题干文本
            const questionTextBlock = questionContainer.querySelector('d2l-html-block[html]');
            const questionText = questionTextBlock
                ? decodeHtml(questionTextBlock.getAttribute('html'))
                : '';

            // 获取选项
            const answerRows = questionContainer.querySelectorAll('fieldset table tbody tr');
            const answers = [];
            let index = 1;

            answerRows.forEach((row) => {
                const answerBlock = row.querySelector('div.d2l-htmlblock-untrusted d2l-html-block');
                const answerText = answerBlock
                    ? decodeHtml(answerBlock.getAttribute('html'))
                    : '';
                answers.push({
                    index: index++,
                    text: answerText
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

    // 将 HTML 字符转换为纯文本
    function decodeHtml(html) {
        const txt = document.createElement('textarea');
        txt.innerHTML = html;
        return txt.value;
    }

})();
