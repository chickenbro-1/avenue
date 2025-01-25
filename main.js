// ==UserScript==
// @name         D2L Quiz Scraper
// @namespace    http://tampermonkey.net/
// @version      0.5
// @description  抓取 D2L Quiz 中的选择题题目与选项
// @author       William
// @match https://avenue.cllmcmaster.ca/d2l/lms/quizzing/user/attempt/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';
    // 当页面加载或更新 DOM 后执行
    window.addEventListener('load', () => {
        const quizData = parseQuizData();
        if (quizData.length != 0) {
            console.log('抓取结果: ', quizData);
            // 请求方式post JSON格式
            const requestData = {
                "questions_data":quizData
            }
            postQuizData(requestData)
                .then((res) => {
                    // res 就是后端返回的 JSON 数据
                    console.log('后端返回的数据:', res);
                })
                .catch((error) => {
                    // 异常处理
                    console.error('请求出错:', error);
                });
        }

        // 这里可以根据需要做进一步处理，比如：
        // 1) 将数据上传到服务器
        // 2) 下载为 JSON 文件
        // 3) 显示到页面中
    });

    function postQuizData(quizData) {
        // 发起 POST 请求，发送 JSON 数据
        fetch('https://techflowlab.xyz/api/answer-questions/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(quizData)
        })
            .then(response => response.json())
            .then(data => {
                console.log('上传成功:', data);
                return data;
            })
            .catch(error => {
                console.error('上传出错:', error);
                return error;
            });
    }

    /**
     * 解析页面中的题目与选项数据
     * @returns {Array} 数组，每个元素是 { questionNumber, questionText, answers } 这样的对象
     */
    function parseQuizData() {
        // 每个问题的标题区块一般带有 .dhdg_2 这个类（包含“Question X”）
        const questionDivs = document.querySelectorAll('div.dco');
        const quizData = [];
        let id = 1;
        questionDivs.forEach((questionDiv) => {

            // 2. 获取题目容器（通常下一个兄弟节点包含题干和选项）
            const questionContainer = questionDiv.nextElementSibling;
            if (!questionContainer) return;

            // 3. 获取题干文本
            //    题目文本常在 <d2l-html-block html="..."></d2l-html-block> 中
            //    如果想去除 HTML，仅保留纯文本，可以自行解析 .getAttribute('html') 的内容
            const questionTextBlock = questionContainer.querySelector('d2l-html-block[html]');
            const questionText = questionTextBlock
                ? decodeHtml(questionTextBlock.getAttribute('html'))
                : '';

            // 4. 获取选项列表
            //    选项区域一般在 <fieldset> -> <table> -> <tbody> -> <tr> 中
            //    每个 <tr> 都对应一个选项
            const answerRows = questionContainer.querySelectorAll('fieldset table tbody tr');
            const answers = [];
            let index = 1;

            answerRows.forEach((row) => {
                // 每个选项文本常在 <div class="d2l-htmlblock-untrusted"><d2l-html-block html="..."></d2l-html-block></div>
                const answerBlock = row.querySelector('div.d2l-htmlblock-untrusted d2l-html-block');
                const answerText = answerBlock
                    ? decodeHtml(answerBlock.getAttribute('html'))
                    : '';
                answers.push({
                    index: index++,
                    text: answerText
                });
            });


            if (questionText != '' || questionText.length != 0) {
                quizData.push({
                    id: id,
                    questionText,
                    answers
                });
                id++;
            }
        });

        return quizData;
    }

    function decodeHtml(html) {
        const txt = document.createElement('textarea');
        txt.innerHTML = html;
        return txt.value;
    }
})();
