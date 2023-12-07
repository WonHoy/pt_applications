import numpy as np
from operator import attrgetter, itemgetter
from math import log
# from joint_analysis.analysis.stiffness import *


RIVET = 'rivet'
BOLT = 'bolt'
BOEING_METHOD = 'boeing2'
BOEING3PLUS_METHOD = 'boeing3+'
DOUGLAS_METHOD = 'swift'  # 'Swift_Douglas'
AIRBUS_METHOD = 'huth'    # 'Huth_Airbus'
UNDEFINED_METHOD = 'Undefined method'
METHODS = [DOUGLAS_METHOD, BOEING_METHOD, AIRBUS_METHOD, BOEING3PLUS_METHOD]


class Plate:
    def __init__(self, plate_id: int, plate_dict: dict):
        self.id = plate_id
        self.material_id = plate_dict['material']
        self.coord_y = plate_dict['coord']
        self.E = plate_dict['E']
        self.first_node = plate_dict['firstNodeCoord']
        self.last_node = plate_dict['secondNodeCoord']

    def __str__(self):
        return f'Plate plate_id = {self.id} coord_y = {self.coord_y} node1_id = {self.first_node} node2_id = {self.last_node}'


class PlatePoint:
    def __init__(self, plate_id: int, thickness: float, area: float, coord_y: int, material_id: str, plate_E: float):
        self.id = plate_id
        self.thickness = thickness
        self.area = area
        self.coord_y = coord_y
        self.material_id = material_id
        self.E = plate_E

    def print(self):
        print('class PLATE')
        print(f'id: {self.id}')
        print(f'thickness: {self.thickness}')
        print(f'area: {self.area}')
        print(f'coord_y: {self.coord_y}')
        print(f'material: {self.material_id}')


class Node:
    def __init__(self, joint_info: dict, index: int):
        node_dict = joint_info['nodes'][index]
        self.id = node_dict['id']
        self.coord_x = node_dict['coord_x']
        self.fastener_type = node_dict['fastener_type']  # 'rivet' or 'bolt'
        self.fastener_id = node_dict['fastener_id']
        self.fastener_Ebb = node_dict['Ebb']
        self.fastener_Gb = node_dict['Gb']
        self.fastener_dia = node_dict['fast_dia']
        self.hole_dia = node_dict['hole_dia']
        self.spacing = node_dict['spacing']
        self.fasteners_qty = node_dict['quantity']
        self.plates = []
        plates_dict = joint_info['plates']
        self.plates_qty = len(node_dict['plates_id'])

        for i in range(self.plates_qty):
            plate_id = node_dict['plates_id'][i]
            thickness = node_dict['plates_th'][i]
            # width = node_dict['plates_width'][i]
            area = node_dict['plates_area'][i]
            print('type', type(plates_dict[plate_id]))
            print('plates_dict[plate_id]', plates_dict[plate_id])
            coord_y = plates_dict[plate_id]['coord']
            material_id = plates_dict[plate_id]['material']
            plate_E = plates_dict[plate_id]['E']
            plate = PlatePoint(plate_id, thickness, area, coord_y, material_id, plate_E)
            self.plates.append(plate)
        self.plates = sorted(self.plates, key=attrgetter('coord_y'))
        self.plate_ids = [plate.id for plate in self.plates]

    def get_diameter(self):
        if self.fastener_type == RIVET:
            diameter = self.hole_dia
        else:
            diameter = self.fastener_dia
        return diameter

    def check_fastend(self, plate1_id: int, plate2_id: int) -> bool:
        if self.fastener_id != '' and {plate1_id, plate2_id}.issubset(set(self.plate_ids)):
            return True
        else:
            return False

    def adjacent_plates_pairs_between(self, plate_id1: int, plate_id2: int) -> list:
        plate_ids = self.plate_ids
        index1 = plate_ids.index(plate_id1)
        index2 = plate_ids.index(plate_id2)
        if index1 < index2:
            plates_stack = plate_ids[index1:index2+1]
        else:
            plates_stack = plate_ids[index2:index1 + 1]
        stack_length = len(plates_stack)
        pairs = []
        for i in range(stack_length-1):
            pairs.append([plates_stack[i], plates_stack[i+1]])
        return pairs

    def plate(self, plate_id: int) -> PlatePoint:
        index = self.plate_ids.index(plate_id)
        return self.plates[index]


class BoundaryConditions:
    def __init__(self, joint_info: dict):
        bc_dict = joint_info['boundary_conditions']
        nodes_ids = bc_dict['nodes_id']
        plates_ids = bc_dict['plates_id']
        constraints = bc_dict['constraints']

        self.constraints = []
        # self.node_id = nodes_ids[index]
        # self.plate_id = plates_ids[index][0]
        # if len(constraints[index]) != 0:
        #     self.constraint = constraints[index][0]
        # else:
        #     self.constraint = 0.0
        # self.constraints = []
        for i in range(len(nodes_ids)):
            for j in range(len(plates_ids[i])):
                self.constraints.append((nodes_ids[i], plates_ids[i][j], constraints[i][j]))  # For now, it's assumed that bc_constraint = 0

    def check_constrained(self, node_id: int, plate_id: int)-> bool:
        if (node_id, plate_id, 0) in self.constraints:
            return True
        else:
            return False
    def __str__(self):
        return str(self.constraints)




class Load:
    def __init__(self, node_id: int, plate_id: int, load_value: float):
        # load_dict = joint_info['loads']
        # nodes_ids = load_dict['nodes_id']
        # plates_ids = load_dict['plates_id']
        # loads = load_dict['loads']
        self.node_id = node_id  #nodes_ids[index]
        self.plate_id = plate_id  #plates_ids[index][0]
        self.load_value = load_value  #loads[index][0]


class JointInputData:
    def __init__(self, joint_dict):
        self.nodes = []
        self.plates = []
        self.plates_ids = []
        self.nodes_ids = []
        self.boundary_conditions = []
        self.loads = []
        self.nodes_qty = 0
        self.plates_qty = 0

        method = joint_dict['method']
        if method in METHODS:
            self.method = method
        else:
            self.method = UNDEFINED_METHOD

        # Nodes
        for i in range(len(joint_dict['nodes'])):
            node = Node(joint_dict, i)
            self.nodes.append(node)
        self.nodes = sorted(self.nodes, key=attrgetter('coord_x'))
        self.nodes_qty = len(self.nodes)

        # Plates
        for plate_id in list(joint_dict['plates']):
            plate_dict = joint_dict['plates'][plate_id]
            plate = Plate(plate_id, plate_dict)
            self.plates.append(plate)
        self.plates = sorted(self.plates, key=attrgetter('coord_y', 'first_node'))
        for plate in self.plates:
            print('Class Plate')
            print(plate)

        # Plate ids
        self.plates_ids = [plate.id for plate in self.plates]  # plates_ids_sorted_by_y(joint_dict)
        self.plates_qty = len(self.plates_ids)

        # Node ids
        self.nodes_ids = [node.id for node in self.nodes]

        # Boundary conditions
        # for i in range(len(joint_dict['boundary_conditions']['nodes_id'])):
        #     boundary_condition = BoundaryCondition(joint_dict, i)
        #     self.boundary_conditions.append(boundary_condition)
        self.boundary_conditions = BoundaryConditions(joint_dict)
        print('Constraints: ', self.boundary_conditions)

        # Loads
        loaded_nodes = joint_dict['loads']['nodes_id']
        loaded_plates = joint_dict['loads']['plates_id']
        load_values = joint_dict['loads']['loads']
        for i in range(len(loaded_nodes)):
            loaded_node_id = loaded_nodes[i]
            for j in range(len(loaded_plates[i])):
                loaded_plate_id = loaded_plates[i][j]
                load_value = load_values[i][j]
                load = Load(loaded_node_id, loaded_plate_id, load_value)
                self.loads.append(load)


# class PlateElement:
#     def __init__(self, element_id, stiffness):
#         id, id1, id2 = element_id
#         [id1, id2] = sorted([id1, id2])
#         self.id = (id, id1, id2)
#         self.stiffness = stiffness
#         self.delta_x = 0
#         self.end_load = 0
#
#     def print(self):
#         print('plate (plate_id, node1_id, node2_id):', self.id, 'stiffness = ', self.stiffness)
#
#     def __str__(self):
#         return f'plate (plate_id, node1_id, node2_id):: {self.id} stiffness = {self.stiffness} delta_x = {self.delta_x} end_load = {self.end_load}'
#
#     def set_displacements(self, coord1_x, disp1, coord2_x, disp2):
#         nodes_data = sorted([(coord1_x,disp1), (coord2_x, disp2)], key = itemgetter(0))  # sort by coord_x
#         self.delta_x = nodes_data[1][1] -nodes_data[0][1]
#         self.end_load = self.delta_x * self.stiffness


class PlateElement():
    def __init__(self, plate_id, node1_id, node2_id, E, area1, area2, t1, t2, coord1_x, coord2_x, coord_y: float):
        nodes_data = sorted([(coord1_x, node1_id, area1, t1), (coord2_x, node2_id, area2, t2)], key=itemgetter(0))
        [(coord1_x, node1_id, area1, t1), (coord2_x, node2_id, area2, t2)] = nodes_data
        self.nodes_ids = [node1_id, node2_id]  # [nodes_data[0][1], nodes_data[1][1]]
        self.coords_x = [coord1_x, coord2_x]  # [nodes_data[0][0], nodes_data[1][0]]
        self.areas = [area1, area2]
        self.thicknesses = [t1, t2]
        self.length = coord2_x - coord1_x
        self.E = E
        # self.W = W
        self.id = (plate_id, node1_id, node2_id)
        self.stiffness = self.calculate_stiffness()
        self.delta_x = None
        self.end_load = None
        self.stresses = [None, None]
        self.coord_y = coord_y

    def calculate_stiffness(self) -> float:
        [area1, area2] = self.areas
        if area1 == area2:
            stiffness = self.E * area1 / self.length
        else:
            stiffness = self.E * (area1 - area2) / (self.length * log(area1 / area2))
        return stiffness

    def __str__(self):
        return f'plate (plate_id, node1_id, node2_id):: {self.id} stiffness = {self.stiffness} delta_x = {self.delta_x} end_load = {self.end_load}'

    def set_displacements(self, coord1_x, disp1, coord2_x, disp2):
        nodes_data = sorted([(coord1_x,disp1), (coord2_x, disp2)], key = itemgetter(0))
        self.delta_x = nodes_data[1][1] -nodes_data[0][1]
        self.end_load = self.delta_x * self.stiffness
        [area1, area2] = self.areas
        stress1 = self.end_load / area1
        stress2 = self.end_load / area2
        self.stresses = [stress1, stress2]

    def get_stress_at(self, node_id):
        index = self.nodes_ids.index(node_id)
        return self.stresses[index]

    def get_thickness_at(self, node_id):
        index = self.nodes_ids.index(node_id)
        return self.thicknesses[index]

    def stiffness_matrix(self):
        stf = self.stiffness
        stf_matrix = np.array([[stf, -stf], [-stf, stf]])
        return stf_matrix


class FastenerElement:
    def __init__(self,element_id, stiffness, diameter):
        id, id1, id2 = element_id
        [id1, id2] = sorted([id1, id2])
        self.id = (id, id1, id2)
        self.D = diameter
        self.ids_sorted_by_y = []
        self.stiffness = stiffness
        self.coords_y = []
        self.delta_x = 0
        self.end_load = 0

    def print(self):
        print('fastener (node_id, plate1_id, plate2_id):', self.id, 'stiffness = ', self.stiffness)

    def __str__(self):
        return f'fastener (node_id, plate1_id, plate2_id): {self.id} stiffness = {self.stiffness} delta_x = {self.delta_x} end_load = {self.end_load}'

    def set_displacements(self, plate1_id, coord1_y, disp1, plate2_id, coord2_y, disp2):
        nodes_data = sorted([(coord1_y, disp1), (coord2_y, disp2)], key=itemgetter(0))  # sort by coord_y
        plates_ids = sorted([(coord1_y, plate1_id), (coord2_y, plate2_id)], key = itemgetter(0))
        [(coord1_y, plate1_id), (coord2_y, plate2_id)] = plates_ids
        self.ids_sorted_by_y = [plate1_id, plate2_id]
        self.coords_y = [coord1_y, coord2_y]
        self.delta_x = nodes_data[1][1] -nodes_data[0][1]
        self.end_load = self.delta_x * self.stiffness

    def get_load_at_node(self, plate_id: int)->float:
        plate_index = self.ids_sorted_by_y.index(plate_id)
        if plate_index == 1:
            return -self.end_load
        if plate_index == 0:
            return self.end_load


class FastenerElement2(FastenerElement):
    def __init__(self,node_id: int, element_id: tuple, stiffness: float, diameter: float, coord_x: float):
        (id1, id2) = element_id
        self.id = (node_id, id1, id2)
        self.ids_sorted_by_y = []
        self.coords_y = []
        self.stiffness = stiffness
        self.diameter = diameter
        self.coord_x = coord_x
        self.delta_x = 0
        self.end_load = 0
        self.adjacent_plates_pairs = []

    def set_adjacent_plates_pairs(self, pairs: list):
        for item in pairs:
            self.adjacent_plates_pairs.append(set(item))


class ConnectedElements:
    #def __init__(self, fastener_elements: list[FastenerElement], plate_elements: list[PlateElement], nodes_ids: list, plates_ids: list):
    def __init__(self, fastener_models, plate_elements, nodes_ids, plates_ids):
        fastener_elements = []
        self.connections = {}

        for node_id in list(fastener_models):
            f_model = fastener_models[node_id]
            if f_model != None:
                fastener_elements.extend(f_model.get_fasteners_elements())

        for node_id in nodes_ids:
            for plate_id in plates_ids:
                connected_fastener_elms = []
                connected_plate_elms = []
                for fastener_elm in fastener_elements:
                    (f_elm_node_id, f_elm_plate1_id, f_elm_plate2_id) = fastener_elm.id
                    if f_elm_node_id == node_id and plate_id in [f_elm_plate1_id, f_elm_plate2_id]:
                        connected_fastener_elms.append(fastener_elm)
                for plate_element_id in list(plate_elements):
                    (p_elm_id, p_elm_node1_id, p_elm_node2_id) = plate_element_id
                    if p_elm_id == plate_id and node_id in [p_elm_node1_id, p_elm_node2_id]:
                        connected_plate_elms.append(plate_elements[plate_element_id])
                if len(connected_fastener_elms)>0 and len(connected_plate_elms)>0:
                    self.connections[(node_id, plate_id)] = (connected_fastener_elms, connected_plate_elms)
        print('connections:', list(self.connections))

    def summary_at(self, node_id: int, plate_id: int) -> tuple:
        # print('connection (node_id, plate_id)', str((node_id, plate_id)))
        connection = self.connections[(node_id, plate_id)]
        (connected_fastener_elms, connected_plate_elms) = connection
        f_summ = 0
        for f_elm in connected_fastener_elms:
            # print(f_elm)
            f_summ = f_summ + f_elm.get_load_at_node(plate_id)
        for p_elm in connected_plate_elms:
            pass
            # print(p_elm)

        # print('fastener load summ: ', f_summ)
        if len(connected_plate_elms) == 2:
            p_elm1 = connected_plate_elms[0]
            p_elm2 = connected_plate_elms[1]
            if abs(p_elm1.end_load) > abs(p_elm2.end_load):
                applied_load = p_elm1.end_load
                ft_app = p_elm1.get_stress_at(node_id)
                bypass_load = p_elm2.end_load
                ft_by =  p_elm2.get_stress_at(node_id)
            else:
                applied_load = p_elm2.end_load
                ft_app = p_elm2.get_stress_at(node_id)
                bypass_load = p_elm1.end_load
                ft_by = p_elm1.get_stress_at(node_id)
        else:
            p_elm = connected_plate_elms[0]
            applied_load = p_elm.end_load
            ft_app = p_elm.get_stress_at(node_id)
            bypass_load = 0.0
            ft_by = 0.0

        # load_transfer = abs(f_summ)
        # applied_load = abs(applied_load)
        # bypass_load = abs(bypass_load)
        load_transfer = f_summ
        applied_load = applied_load
        bypass_load = bypass_load

        f_elm = connected_fastener_elms[0]
        diameter = f_elm.diameter
        p_elm = connected_plate_elms[0]
        thickness = p_elm.get_thickness_at(node_id)
        fbr = load_transfer/(diameter * thickness)

        fbr_ftapp = fbr / ft_app
        ftby_ftapp = ft_by / ft_app
        jarfall_effective_stress = 0.569 * abs(fbr) + abs(ft_by)

        loads_summary = (node_id, plate_id, load_transfer, bypass_load, applied_load)
        stress_summary = (node_id, plate_id, fbr, ft_by, ft_app, fbr_ftapp, ftby_ftapp, jarfall_effective_stress)
        # print(f'applied load = {applied_load}, bypass load = {bypass_load}')
        # print(stress_summary)
        return loads_summary, stress_summary

    def get_loads_summary(self)-> list:
        summary = []
        for (node_id, plate_id) in list(self.connections):
            loads_summary, stress_summary = self.summary_at(node_id, plate_id)
            summary.append(loads_summary)
        return summary

    def get_summary_dicts(self):
        summary = []
        # print('')
        for (node_id, plate_id) in list(self.connections):
            summary_at_node_plate = {}
            (connected_fastener_elms, connected_plate_elms) = self.connections[(node_id, plate_id)]
            coord_x = connected_fastener_elms[0].coord_x
            coord_y = connected_plate_elms[0].coord_y
            loads_summary, stress_summary = self.summary_at(node_id, plate_id)
            (node_id, plate_id, fbr, ft_by, ft_app, fbr_ftapp, ftby_ftapp, jarfall_effective_stress) = stress_summary
            (node_id, plate_id, load_transfer, bypass_load, applied_load) = loads_summary
            summary_at_node_plate['node_id'] = node_id
            summary_at_node_plate['plate_id'] = plate_id
            summary_at_node_plate['coord_x'] = coord_x
            summary_at_node_plate['coord_y'] = coord_y
            summary_at_node_plate['load_transfer'] = load_transfer
            summary_at_node_plate['bypass_load'] = bypass_load
            summary_at_node_plate['applied_load'] = applied_load
            summary_at_node_plate['bearing_stress'] = fbr
            summary_at_node_plate['bypass_stress'] = ft_by
            summary_at_node_plate['applied_stress'] = ft_app
            summary_at_node_plate['bearing_over_applied_stresss'] = fbr_ftapp
            summary_at_node_plate['bypass_over_applied_stress'] = ftby_ftapp
            summary_at_node_plate['jarfall_effective_stress'] = jarfall_effective_stress
            summary.append(summary_at_node_plate)

            # print(f'summary for {(node_id, plate_id)}:')
            # print(summary_at_node_plate)
        return summary


def rus_csv_repair(fname):
    f = open(fname, 'r')
    txt = f.readlines()
    f.close()
    for i in range(len(txt)):
        txt[i] = txt[i].replace('.', ',')
    f = open(fname, 'w')
    f.writelines(txt)
    f.close()


def save_csv(fname, matrix):
    np.savetxt(fname, matrix, delimiter=';')
    rus_csv_repair(fname)


# def plates_ids_sorted_by_y(joint_info: dict) -> list:
#     plates_dict = joint_info['plates']
#     ids = plates_dict.keys()
#     id_y = []
#     for id in ids:
#         coord_y = plates_dict[id]['coord']
#         id_y.append((id, coord_y))
#     print('id_y', id_y)
#     id_y = sorted(id_y, key=itemgetter(1))
#     ids = [item[0] for item in id_y]
#     return ids


def matrix_print(matrix: np.ndarray, title: str):
    print(title+': len=', len(matrix))
    for i in range(len(matrix)):
        row = ''
        if matrix.ndim == 2:
            for j in range(len(matrix[i])):
                row = row + f'{round(matrix[i][j], 0):15}'
        else:
            row = matrix[i]
        print(row)


if __name__ == '__main__':
    from joint_analysis.analysis.onedjoint import *
    # from onedjoint import *

    test_material_DB = {
        '2024':
            {
                'E': 10300000
            },
        '2024-T3':
            {
                'E': 10300000
            },
        '7075':
            {
                'E': 10500000
            }
    }

    test_fastener_DB = {
        'BACR15GF5':
            {'type': 'rivet',
             'D': 0.156,
             'Ebb': 10300000,
             'Gb': 4000000}
    }

    test_joint_info = {'method': 'boeing', 'nodes': [
        {'id': 1, 'coord_x': 0, 'plates_id': [1, 2], 'plates_th': [0.08, 0.063], 'plates_width': [1, 1],
         'plates_area': [0.08, 0.063], 'fastener_id': '', 'Ebb': '', 'Gb': '', 'fast_dia': '', 'hole_dia': '',
         'spacing': '', 'quantity': ''},
        {'id': 2, 'coord_x': 1, 'plates_id': [1, 2, 3], 'plates_th': [0.08, 0.063, 0.121], 'plates_width': [1, 1, 1],
         'plates_area': [0.08, 0.063, 0.121], 'fastener_id': 'BACR15xx6D\n\n\n\n\n                        0.188',
         'Ebb': 16000000, 'Gb': 6150000, 'fast_dia': 0.1875, 'hole_dia': 0.1875, 'spacing': 1, 'quantity': 1},
        {'id': 3, 'coord_x': 2, 'plates_id': [1, 2, 3], 'plates_th': [0.08, 0.063, 0.121], 'plates_width': [1, 1, 1],
         'plates_area': [0.08, 0.063, 0.121], 'fastener_id': 'BACR15xx6D\n\n\n\n\n                        0.188',
         'Ebb': 16000000, 'Gb': 6150000, 'fast_dia': 0.1875, 'hole_dia': 0.1875, 'spacing': 1, 'quantity': 1},
        {'id': 4, 'coord_x': 3, 'plates_id': [3, 2], 'plates_th': [0.121, 0.063], 'plates_width': [1, 1],
         'plates_area': [0.121, 0.063], 'fastener_id': 'BACR15xx6D\n\n\n\n\n                        0.188',
         'Ebb': 16000000, 'Gb': 6150000, 'fast_dia': 0.1875, 'hole_dia': 0.1875, 'spacing': 1, 'quantity': 1},
        {'id': 5, 'coord_x': 4, 'plates_id': [3], 'plates_th': [0.121], 'plates_width': [1], 'plates_area': [0.121],
         'fastener_id': '', 'Ebb': '', 'Gb': '', 'fast_dia': '', 'hole_dia': '', 'spacing': '', 'quantity': ''}],
        'plates': {1: {'material': '2024', 'coord': 2000, 'E': 10500000, 'firstNodeCoord': 2,
                          'secondNodeCoord': 4},
                      2: {'material': '2024', 'coord': 3000, 'E': 10500000, 'firstNodeCoord': 2,
                          'secondNodeCoord': 4},
                      3: {'material': '2024', 'coord': 4000, 'E': 10500000, 'firstNodeCoord': 2,
                          'secondNodeCoord': 5}},
        'plates0': {1: ['al', 1000, 10500000], 2: ['al', 2000, 10500000], 3: ['al', 3000, 10500000]},
        'boundary_conditions': {'nodes_id': [1], 'plates_id': [[2, 1]], 'constraints': [[0, 0]]},
        'loads': {'nodes_id': [5], 'plates_id': [[3]], 'loads': [[1000]]}}

    test_joint_info_tapered = {'method': 'boeing', 'nodes': [
        {'id': 1, 'coord_x': 0, 'plates_id': [1, 2], 'plates_th': [0.08, 0.063], 'plates_width': [1, 1],
         'plates_area': [0.08, 0.063], 'fastener_id': '', 'Ebb': '', 'Gb': '', 'fast_dia': '', 'hole_dia': '',
         'spacing': '', 'quantity': ''},
        {'id': 2, 'coord_x': 1, 'plates_id': [1, 2, 3], 'plates_th': [0.08, 0.063, 0.121], 'plates_width': [1, 1, 1],
         'plates_area': [0.08, 0.063, 0.121], 'fastener_id': 'BACR15xx6D\n\n\n\n\n                        0.188',
         'Ebb': 16000000, 'Gb': 6150000, 'fast_dia': 0.1875, 'hole_dia': 0.1875, 'spacing': 1, 'quantity': 1},
        {'id': 3, 'coord_x': 2, 'plates_id': [1, 2, 3], 'plates_th': [0.08, 0.063, 0.08], 'plates_width': [1, 1, 1],
         'plates_area': [0.08, 0.063, 0.121], 'fastener_id': 'BACR15xx6D\n\n\n\n\n                        0.188',
         'Ebb': 16000000, 'Gb': 6150000, 'fast_dia': 0.1875, 'hole_dia': 0.1875, 'spacing': 1, 'quantity': 1},
        {'id': 4, 'coord_x': 3, 'plates_id': [3, 2], 'plates_th': [0.063, 0.063], 'plates_width': [1, 1],
         'plates_area': [0.121, 0.063], 'fastener_id': 'BACR15xx6D\n\n\n\n\n                        0.188',
         'Ebb': 16000000, 'Gb': 6150000, 'fast_dia': 0.1875, 'hole_dia': 0.1875, 'spacing': 1, 'quantity': 1},
        {'id': 5, 'coord_x': 4, 'plates_id': [3], 'plates_th': [0.121], 'plates_width': [1], 'plates_area': [0.121],
         'fastener_id': '', 'Ebb': '', 'Gb': '', 'fast_dia': '', 'hole_dia': '', 'spacing': '', 'quantity': ''}],
       'plates': {1: {'material': '2024', 'coord': 2000, 'E': 10500000, 'firstNodeCoord': 2,
                      'secondNodeCoord': 4},
                  2: {'material': '2024', 'coord': 3000, 'E': 10500000, 'firstNodeCoord': 2,
                      'secondNodeCoord': 4},
                  3: {'material': '2024', 'coord': 4000, 'E': 10500000, 'firstNodeCoord': 2,
                      'secondNodeCoord': 5}},
         'plates0': {1: ['al', 1000, 10500000], 2: ['al', 2000, 10500000], 3: ['al', 3000, 10500000]},
         'boundary_conditions': {'nodes_id': [1], 'plates_id': [[2, 1]], 'constraints': [[0, 0]]},
         'loads': {'nodes_id': [5], 'plates_id': [[3]], 'loads': [[1000]]}}

    joint_data = JointInputData(test_joint_info)
    model = Joint(test_joint_info, test_material_DB, test_fastener_DB)
    #displacements = model.displacement_vector
    #matrix_print(displacements, 'displacement_vector')