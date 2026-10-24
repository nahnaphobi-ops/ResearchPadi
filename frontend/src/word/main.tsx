import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import WordPane from './WordPane';

/** The ResearchPadi task pane inside Microsoft Word (word.html). */
const root = createRoot(document.getElementById('root')!);
const render = (inWord: boolean) => root.render(<StrictMode><WordPane inWord={inWord} /></StrictMode>);

// Office.onReady also resolves in a plain browser tab (host null), where the pane explains how to install it.
if (typeof Office !== 'undefined') void Office.onReady((info) => render(info.host === Office.HostType.Word));
else render(false);
