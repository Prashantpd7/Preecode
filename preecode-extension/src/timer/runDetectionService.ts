import * as vscode from 'vscode';
import { preecodeStore } from '../state/store';
import { PracticeTimerService } from './practiceTimerService';

export class RunDetectionService {
  constructor(private readonly timerService: PracticeTimerService) {}

  bind(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.window.onDidStartTerminalShellExecution(() => {
        this.timerService.pauseForRun();
        preecodeStore.setState((state) => ({
          ...state,
          practice: {
            ...state.practice,
            attempts: state.practice.attempts + 1,
            runStatus: 'running'
          }
        }));
      }),
      vscode.window.onDidEndTerminalShellExecution((event) => {
        const success = event.exitCode === 0;
        this.timerService.onRunResult(success);
        preecodeStore.setState((state) => ({
          ...state,
          practice: {
            ...state.practice,
            success,
            runStatus: success ? 'success' : 'failure'
          }
        }));
      })
    );
  }
}
