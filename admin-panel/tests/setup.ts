import '@testing-library/jest-dom/vitest';
import {cleanup} from '@testing-library/react';
import {afterEach} from 'vitest';
afterEach(cleanup);

// jsdom has no native dialog implementation; focus trapping is verified in the browser.
HTMLDialogElement.prototype.showModal=function(){this.open=true;(this.querySelector<HTMLElement>('[autofocus]') ?? this.querySelector<HTMLElement>('button,input,textarea,select'))?.focus();};
HTMLDialogElement.prototype.close=function(){this.open=false;};
