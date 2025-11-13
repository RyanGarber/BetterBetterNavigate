// ==UserScript==
// @name         BetterBetterNavigate
// @namespace    mailto:ryanmichaelgarber@gmail.com
// @version      1.0.0
// @description  Enhances the Navigate360 experience with additional features and improvements.
// @author       Ryan Garber
// @match        *://*.navigate.eab.com/*
// @grant        GM.xmlHttpRequest
// @grant        GM.getResourceText
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.log
// @resource     course-browser course_browser.user.html
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

const THROTTLE_REQUESTS = 2000;

const BBN = {
    GM: GM,
    domain: unsafeWindow.location.host,
    term: null,
    courses: null,
    updated: null,
    log: (...data) => {
        GM.log('[BBN]', ...data);
    },
    start: async () => {
        BBN.log('Starting BetterBetterNavigate...');
        
        BBN.log('Waiting for DOM...');
        await BBN.waitForElements('app-header nav hi-link');

        BBN.log('Loading data...');
        const terms = JSON.parse(await BBN.fetch(`https://${BBN.domain}/api/v1/cat/terms/`));
        const now = Date.now();
        await GM.setValue('term', BBN.term = terms.data
            .filter(t => !isNaN(new Date(t.term_start_dt).getTime()))
            .sort((a, b) =>
                Math.abs(new Date(a.term_start_dt).getTime() - now) - Math.abs(new Date(b.term_start_dt).getTime() - now)
            )[0]);
        BBN.courses = await GM.getValue('courses', []);
        BBN.updated = await GM.getValue('updated', null);

        BBN.log('Adding styles...')
        await BBN.injectElement(document.head, '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">');
        await BBN.injectElement(document.head, '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/mdb-ui-kit/6.4.0/mdb.min.css">');
        await BBN.injectElement(document.head, '<script src="https://cdnjs.cloudflare.com/ajax/libs/mdb-ui-kit/6.4.0/mdb.min.js"></script>');
        document.querySelectorAll('.container').forEach(c => c.classList.remove('container'));

        BBN.log('Adding course browser...');
        const overlay = document.createElement('div');
        overlay.id = 'course-browser';
        overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100vh; overflow: auto; background: #fff; z-index: 99999; display: none';
        overlay.innerHTML = GM.getResourceText('course-browser');
        document.body.appendChild(overlay);
        await BBN.executeScripts(overlay);
        
        BBN.log('Adding navigation...');
        const temp = document.createElement('div');
        temp.innerHTML = `<a aesthetic="navigation" class="mlsxxx ng-scope" aria-current="false" style="padding-right: var(--hi-size--small-xxx); text-decoration: none"><span class="text-sz-l">Browse Courses</span></hi-link>`;
        const browseTab = temp.firstChild;
        browseTab.addEventListener('click', () => overlay.style.display = 'block');
        const scheduleTab = document.querySelector('app-header nav hi-link:last-of-type');
        scheduleTab.insertAdjacentElement('beforebegin', browseTab);
        temp.remove();
        
        BBN.log('Started!');
    },
    waitForElements: (querySelector) => {
        return new Promise((resolve) => {
            const elements = document.querySelectorAll(querySelector);
            if (elements.length) {
                resolve(elements);
                return;
            }
            const observer = new MutationObserver(() => {
                const elements = document.querySelectorAll(querySelector);
                if (elements.length) {
                    resolve(elements);
                    observer.disconnect();
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        });
    },
    injectElement: async (parent, html) => {
        const temp = document.createElement('div');
        temp.innerHTML = html;
        const element = temp.firstChild;
        parent.appendChild(element);
        await BBN.executeScripts(element);
        return element;
    },
    executeScripts: async (element) => {
        const runScript = async (oldScript) => {
            const newScript = document.createElement('script');
            let source = oldScript.innerHTML;
            if (oldScript.src) source = await BBN.fetch(oldScript.src);
            newScript.appendChild(document.createTextNode(source));
            oldScript.parentNode.replaceChild(newScript, oldScript);
        }
        if (element.tagName === 'SCRIPT') await runScript(element);
        const childScripts = element.querySelectorAll('script');
        for (let i = 0; i < childScripts.length; i++) await runScript(childScripts[i]);
    },
    refreshCourses: async (status=()=>{}) => {
        status({ step: 'downloading courses', current: 0, total: 1 });
        const courses = JSON.parse(await BBN.fetch(`https://${BBN.domain}/api/v1/cat/course_search/?term=${BBN.term.id}&only_available=false&offset=0&limit=1000`));

        status({ step: 'downloading sections', current: 0, total: courses.data.length });
        let current = 0;
        for (const course of courses.data) {
            status({ step: 'downloading sections', current: ++current, total: courses.data.length });
            const response = await BBN.fetch(`https://${BBN.domain}/api/v1/cat/sections/term/${BBN.term.id}/course/${course.id}/section_type/0/`);
            const sections = JSON.parse(response).section;
            course.sections = Object.values(sections);
            await new Promise(resolve => setTimeout(resolve, THROTTLE_REQUESTS));
        }

        status({ step: 'finishing up', current: 0, total: 1 });
        await GM.setValue('courses', BBN.courses = courses.data);
        await GM.setValue('updated', BBN.updated = new Date().toISOString());
    },
    fetch: async (url) => {
        return await new Promise((resolve) => {
            GM.xmlHttpRequest({
                method: 'GET',
                url: url,
                onload: (response) => resolve(response.responseText),
                onerror: unsafeWindow.console.error
            });
        })
    }
};

if (!unsafeWindow.BBN) {
    unsafeWindow.BBN = BBN;
    BBN.start();
}