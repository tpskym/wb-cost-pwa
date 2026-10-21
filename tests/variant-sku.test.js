import {test} from 'node:test';
import assert from 'node:assert/strict';
import {variantSkuPrefix,variantSkuForColor} from '../calc.js';
test('variant SKU removes only the final segment and supports manual names',()=>{
 assert.equal(variantSkuPrefix('stand_aw_number_three_black'),'stand_aw_number_three_');
 assert.equal(variantSkuForColor('stand_aw_number_three_','Черный'),'stand_aw_number_three_black');
 assert.equal(variantSkuForColor('stand_aw_number_three_black','Белый'),'stand_aw_number_three_white');
 assert.equal(variantSkuPrefix('stand'),'stand_');assert.equal(variantSkuPrefix(''),'');
 assert.equal(variantSkuForColor('stand_','Другой вариант'),null);
});
