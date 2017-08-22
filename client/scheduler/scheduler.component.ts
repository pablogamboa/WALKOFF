import { Component } from '@angular/core';
import { FormControl } from '@angular/forms';
import * as _ from 'lodash';
import { NgbModal, NgbActiveModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { ToastyService, ToastyConfig, ToastOptions, ToastData } from 'ng2-toasty';
import "rxjs/add/operator/debounceTime";

import { SchedulerModalComponent } from './scheduler.modal.component';

import { SchedulerService } from './scheduler.service';

import { AvailableSubscription } from '../models/availableSubscription';
import { Case } from '../models/case';
import { Workflow } from '../models/workflow';
import { ScheduledTask } from '../models/scheduledTask';

@Component({
	selector: 'scheduler-component',
	templateUrl: 'client/scheduler/scheduler.html',
	styleUrls: [
		'client/scheduler/scheduler.css',
	],
	providers: [SchedulerService]
})
export class SchedulerComponent {
	currentController: string;
	schedulerStatus: string;
	scheduledTasks: ScheduledTask[] = [];
	displayScheduledTasks: ScheduledTask[] = [];
	workflowNames: string[] = [];

	filterQuery: FormControl = new FormControl();

	constructor(private schedulerService: SchedulerService, private modalService: NgbModal, private toastyService:ToastyService, private toastyConfig: ToastyConfig) {
		this.currentController = "Default Controller";

		// this.getAvailableSubscriptions();
		// this.getCases();
		this.getSchedulerStatus();
		this.getWorkflowNames();
		this.getScheduledTasks();

		this.filterQuery
			.valueChanges
			.debounceTime(500)
			.subscribe(event => this.filterScheduledTasks());
	}

	filterScheduledTasks(): void {
		let searchFilter = this.filterQuery.value ? this.filterQuery.value.toLocaleLowerCase() : '';

		this.displayScheduledTasks = this.scheduledTasks.filter((s) => {
			return (s.name.toLocaleLowerCase().includes(searchFilter) ||
				s.description.toString().includes(searchFilter));
		});
	}

	getSchedulerStatus(): void {
		this.schedulerService
			.getSchedulerStatus()
			.then(schedulerStatus => this.schedulerStatus = schedulerStatus)
			.catch(e => this.toastyService.error(`Error retrieving scheduler status: ${e.message}`));
	}

	changeSchedulerStatus(status: string): void {
		if (status === 'start' && this.schedulerStatus === 'paused') status = 'resume';

		this.schedulerService
			.changeSchedulerStatus(status)
			.then((newStatus) => {
				if (newStatus) this.schedulerStatus = newStatus;
			})
			.catch(e => this.toastyService.error(`Error changing scheduler status: ${e.message}`));
	}

	executeWorkflow(workflow: Workflow): void {
		this.schedulerService
			.executeWorkflow(workflow.name, workflow.name)
			.then(() => this.toastyService.success(`Workflow ${workflow.name} has been scheduled to execute.`))
			.catch(e => this.toastyService.error(`Error executing workflow: ${e.message}`));
	}

	getScheduledTasks(): void {
		this.schedulerService
			.getScheduledTasks()
			.then(scheduledTasks => this.displayScheduledTasks = this.scheduledTasks = scheduledTasks)
			.catch(e => this.toastyService.error(`Error retrieving scheduled tasks: ${e.message}`));
	}

	addScheduledTask(): void {
		const modalRef = this.modalService.open(SchedulerModalComponent);
		modalRef.componentInstance.title = 'Schedule a New Task';
		modalRef.componentInstance.submitText = 'Add Scheduled Task';
		modalRef.componentInstance.workflowNames = this.workflowNames;

		this._handleModalClose(modalRef);
	}

	editScheduledTask(task: ScheduledTask): void {
		const modalRef = this.modalService.open(SchedulerModalComponent);
		modalRef.componentInstance.title = `Edit Task ${task.name}`;
		modalRef.componentInstance.submitText = 'Save Changes';
		modalRef.componentInstance.workflowNames = this.workflowNames;

		modalRef.componentInstance.workingScheduledTask = _.cloneDeep(task);

		this._handleModalClose(modalRef);

	}

	private _handleModalClose(modalRef: NgbModalRef): void {
		modalRef.result
			.then((result) => {
				//Handle modal dismiss
				if (!result || !result.scheduledTask) return;

				//On edit, find and update the edited item
				if (result.isEdit) {
					let toUpdate = _.find(this.scheduledTasks, st => st.id === result.scheduledTask.id);
					Object.assign(toUpdate, result.scheduledTasks);

					this.filterScheduledTasks();

					this.toastyService.success(`Scheduled task "${result.scheduledTask.name}" successfully edited.`);
				}
				//On add, push the new item
				else {
					this.scheduledTasks.push(result.scheduledTask);

					this.filterScheduledTasks();

					this.toastyService.success(`Scheduled task "${result.scheduledTask.name}" successfully added.`);
				}
			},
			(error) => { if (error) this.toastyService.error(error.message); });
	}

	deleteScheduledTask(taskToDelete: ScheduledTask): void {
		if (!confirm(`Are you sure you want to delete the scheduled task "${taskToDelete.name}"?`)) return;

		this.schedulerService
			.deleteScheduledTask(taskToDelete.id)
			.then(() => {
				this.scheduledTasks = _.reject(this.scheduledTasks, scheduledTask => scheduledTask.id === taskToDelete.id);

				this.filterScheduledTasks();

				this.toastyService.success(`Scheduled Task "${taskToDelete.name}" successfully deleted.`);
			})
			.catch(e => this.toastyService.error(`Error deleting task: ${e.message}`));
	}

	enableScheduledTask(task: ScheduledTask): void {
		this.schedulerService
			.enableScheduledTask(task.id)
			.then(() => task.enabled = true)
			.catch(e => this.toastyService.error(`Error enabling task: ${e.message}`));
	}

	disableScheduledTask(task: ScheduledTask): void {
		this.schedulerService
			.disableScheduledTask(task.id)
			.then(() => task.enabled = false)
			.catch(e => this.toastyService.error(`Error disabling task: ${e.message}`));
	}

	getWorkflowNames(): void {
		this.schedulerService
			.getPlaybooks()
			.then((playbooks) => {
				playbooks = _.map(playbooks, function (workflows: any, playbook) {
					workflows = _.map(workflows, function (w: string) {
						return [playbook, w];
					});

					return workflows;
				});

				playbooks = _.flatten(playbooks);

				this.workflowNames = _.map(playbooks, function (pb: string[]) {
					return `${pb[0]} - ${pb[1]}`;
				});

				console.log(this.workflowNames);
			});
	}
}