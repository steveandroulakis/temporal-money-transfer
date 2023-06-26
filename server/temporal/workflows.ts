import {
  proxyActivities, setHandler, sleep, uuid4, ApplicationFailure
} from '@temporalio/workflow';
import { ResultObj, StateObj, StripeChargeResponse, WorkflowParameterObj } from './interfaces';
import { TASK_QUEUE_ACTIVITY } from './config';
import { defineQuery } from '@temporalio/workflow';
import Stripe from 'stripe';

import type * as activities from './activities';

const { createCharge } = proxyActivities<typeof activities>({
  taskQueue: TASK_QUEUE_ACTIVITY,
  startToCloseTimeout: '5 seconds',
  retry: {
    nonRetryableErrorTypes: ['StripeInvalidRequestError']
  }
});

export const getStateQuery = defineQuery<StateObj>('getState');

/** A workflow that simply calls an activity */
export async function moneyTransferWorkflow(workflowParameterObj: WorkflowParameterObj): Promise<ResultObj> {

  let progressPercentage = 25;
  let transferState = "starting";
  let chargeResult: StripeChargeResponse = { chargeId: "" };

  setHandler(getStateQuery, () => ({
    progressPercentage: progressPercentage,
    transferState: transferState,
    chargeResult: chargeResult
  }));

  await sleep('2 seconds');

  // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  // throw new Error("Throwing an exception (will pause workflow).");

  progressPercentage = 75;
  transferState = "running";

  const idempotencyKey = uuid4();

  try {
    chargeResult = await createCharge(idempotencyKey, workflowParameterObj.amountCents);
  } catch (err) {
    const message = `Failed to charge customer for. Error: ${err}`
    throw ApplicationFailure.create({ message })
  }


  await sleep('5 seconds');

  progressPercentage = 100;
  transferState = "finished";

  return { stripeChargeResponse: chargeResult };

}